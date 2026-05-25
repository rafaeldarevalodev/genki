#!/usr/bin/env python3
"""Genki VibeVoice-7B TTS Server - Port 8091

VibeVoice Large (7B) via appautomaton/mlx-speech runtime.
Pure MLX inference on Apple Silicon.

Uso:
    python vibevoice7b_server.py                    # Puerto default (8091)
    python vibevoice7b_server.py --port 8091       # Puerto custom
    python vibevoice7b_server.py --model-dir /path/to/model
    python vibevoice7b_server.py --reload          # Auto-reload para desarrollo
"""

import os
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

import io
import json
import wave
import sys
import threading
import argparse
import time
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from pathlib import Path
from typing import Optional

DEFAULT_PORT = 8091
DEFAULT_MODEL_DIR = None  # Auto-download from appautomaton/vibevoice-mlx
WORKERS = 2

# Parámetros de generación - matching upstream defaults
CFG_SCALE = 1.3
DIFFUSION_STEPS = 20
DIFFUSION_STEPS_FAST = None
DIFFUSION_WARMUP_FRAMES = 10
MAX_NEW_TOKENS = 2048
SEED = 42

# Voces built-in por defecto (speaker cloning sin reference audio)
DEFAULT_VOICES = [
    "en-Emma_woman",
    "en-Davis_man",
    "en-Carter_man",
    "en-Grace_woman",
    "en-Mike_man",
    "en-Frank_man",
    "en-Sara_woman",
    "en-Max_man",
    "en-July_Sexy_woman",
    "en-Jane_woman",
    "en-Giuseppe_man",
    "en-Andi_Male",
    "en-Lady_female",
    "en-Hanel_male",
    "en-Mark_Eng",
]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REFERENCE_VOICES_DIR = os.path.join(SCRIPT_DIR, "reference_voices")

VOICE_TO_REFERENCE = {
    "en-Emma_woman": "en_Emma_woman.wav",
    "en-Davis_man": "en_Davis_man.wav",
    "en-Carter_man": "en_Carter_man.wav",
    "en-Grace_woman": "en_Grace_woman.wav",
    "en-Mike_man": "en_Mike_man.wav",
    "en-Frank_man": "en_Frank_man.wav",
    "en-Sara_woman": "en_Sara_woman.wav",
    "en-Max_man": "en_Max_man.wav",
    "en-July_Sexy_woman": "en_July_Sexy_woman.wav",
    "en-Jane_woman": "en_Jane_woman.wav",
    "en-Giuseppe_man": "en_Giuseppe_man.wav",
    "en-Andi_Male": "en_Andi_Male.wav",
    "en-Lady_female": "en_Lady_female.wav",
    "en-Hanel_male": "en_Hanel_male.wav",
    "en-Mark_Eng": "en_Mark_Eng.wav",
}

model = None
model_lock = threading.Lock()
model_name = "appautomaton/vibevoice-mlx"
_model_dir = DEFAULT_MODEL_DIR


def load_model_once(model_dir: Optional[str] = None) -> dict:
    """Carga el modelo VibeVoice-7B una sola vez al iniciar."""
    global model, model_name, _model_dir

    print(f"[INIT] Loading VibeVoice-7B (appautomaton/mlx-speech)", flush=True)
    print("[INIT] This may take a few minutes on first run (download + compile)...", flush=True)

    import mlx.core as mx
    print(f"[INIT] MLX version: {mx.__version__}", flush=True)

    sys.path.insert(0, str(Path(__file__).parent / "mlx-speech" / "src"))
    from mlx_speech.models.vibevoice.checkpoint import load_vibevoice_model
    from mlx_speech.models.vibevoice.tokenizer import VibeVoiceTokenizer
    from mlx_speech.generation.vibevoice import (
        VibeVoiceGenerationConfig,
        synthesize_vibevoice,
    )
    from mlx_speech.audio.io import write_wav

    print(f"[INIT] Downloading and loading model from HuggingFace...", flush=True)
    start = time.perf_counter()

    model_repo = "appautomaton/vibevoice-mlx"

    from mlx_speech._hub import get_model_path
    model_local_path = get_model_path(model_repo)
    model_int8_path = model_local_path / "mlx-int8"
    if not model_int8_path.exists():
        raise FileNotFoundError(f"Model not found at {model_int8_path}")

    loaded = load_vibevoice_model(str(model_int8_path), prefer_mlx_int8=True, strict=False)
    tokenizer_dir = str(loaded.model_dir)
    tokenizer = VibeVoiceTokenizer.from_path(tokenizer_dir)

    elapsed = time.perf_counter() - start
    print(f"[INIT] Model loaded in {elapsed:.1f}s", flush=True)
    print(f"[INIT] Quantization: {loaded.quantization}", flush=True)
    print(f"[INIT] Sample rate: {loaded.config.sampling_rate}", flush=True)

    model = {
        'instance': loaded.model,
        'tokenizer': tokenizer,
        'model_dir': loaded.model_dir,
        'sample_rate': loaded.config.sampling_rate,
        'synthesize': synthesize_vibevoice,
        'config_class': VibeVoiceGenerationConfig,
    }
    _model_dir = model_dir or DEFAULT_MODEL_DIR
    model_name = "appautomaton/vibevoice-mlx"
    return model


def generate_audio(text: str, voice: str = "en-Emma_woman", reference_audio_path: Optional[str] = None, reference_audio_data: Optional[str] = None) -> tuple:

    if model is None:
        raise Exception("Model not loaded")

    print(f"[TTS] Generating: '{text[:80]}...'", flush=True)
    print(f"[TTS] voice={voice}, cfg_scale={CFG_SCALE}, diffusion_steps={DIFFUSION_STEPS}", flush=True)

    try:
        start = time.perf_counter()

        config = model['config_class'](
            max_new_tokens=MAX_NEW_TOKENS,
            cfg_scale=CFG_SCALE,
            diffusion_steps=DIFFUSION_STEPS,
            diffusion_steps_fast=DIFFUSION_STEPS_FAST,
            diffusion_warmup_frames=DIFFUSION_WARMUP_FRAMES,
            do_sample=False,  # deterministic / greedy (matching upstream)
            temperature=0.0,
            top_p=1.0,
            seed=SEED,
        )

        voice_samples = None

        # If no explicit reference provided, check voice mapping
        if not reference_audio_path and not reference_audio_data:
            ref_filename = VOICE_TO_REFERENCE.get(voice)
            if ref_filename:
                potential_path = os.path.join(REFERENCE_VOICES_DIR, ref_filename)
                if os.path.exists(potential_path):
                    reference_audio_path = potential_path
                    print(f"[TTS] Using mapped reference audio: {reference_audio_path}", flush=True)

        # Load from file path
        if reference_audio_path and os.path.exists(reference_audio_path):
            import mlx.core as mx
            from mlx_speech.audio.io import load_audio
            waveform, sr = load_audio(reference_audio_path, sample_rate=24000, mono=True)
            voice_samples = [waveform.reshape(1, 1, -1)]
            print(f"[TTS] Using reference audio: {reference_audio_path}", flush=True)

        # Load from base64 data
        elif reference_audio_data:
            import base64
            import mlx.core as mx
            audio_bytes = base64.b64decode(reference_audio_data)
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name
            try:
                from mlx_speech.audio.io import load_audio
                waveform, sr = load_audio(tmp_path, sample_rate=24000, mono=True)
                voice_samples = [waveform.reshape(1, 1, -1)]
                print(f"[TTS] Using base64 reference audio ({len(audio_bytes)} bytes)", flush=True)
            finally:
                os.unlink(tmp_path)

        with model_lock:
            result = model['synthesize'](
                model['instance'],
                model['tokenizer'],
                text,
                voice_samples=voice_samples,
                config=config,
            )

        elapsed = time.perf_counter() - start
        audio_duration = result.waveform.shape[0] / result.sample_rate
        rtf = audio_duration / elapsed if elapsed > 0 else 0

        print(f"[TTS] Generated {audio_duration:.2f}s audio in {elapsed:.2f}s (RTF: {rtf:.2f}x)", flush=True)
        print(f"[TTS] Stop reached: {result.stop_reached}, tokens: {result.generated_tokens}", flush=True)

        audio_np = np.array(result.waveform, dtype=np.float32)
        if audio_np.ndim > 1:
            audio_np = audio_np.flatten()

        max_abs = max(abs(audio_np.min()), abs(audio_np.max()))
        if max_abs > 1.0:
            audio_np = audio_np / max_abs

        return audio_np, result.sample_rate

    except Exception as e:
        print(f"[TTS Error] Generation failed: {e}", flush=True)
        raise


def post_process_audio(audio, sample_rate: int = 24000, threshold: float = 0.01):
    """Post-procesamiento: trim silence, fades."""
    if len(audio) == 0:
        return audio

    energy = np.abs(audio)

    onset_indices = np.where(energy > threshold)[0]
    if len(onset_indices) > 0:
        start_idx = onset_indices[0]
        if start_idx > sample_rate * 0.05:
            start_idx = max(0, start_idx - int(sample_rate * 0.01))
        audio = audio[start_idx:]

    energy = np.abs(audio)
    offset_indices = np.where(energy > threshold)[0]
    if len(offset_indices) > 0:
        end_idx = offset_indices[-1]
        end_idx = min(len(audio), end_idx + int(sample_rate * 0.05))
        audio = audio[:end_idx]

    if len(audio) < 100:
        return audio

    fade_in_samples = int(sample_rate * 0.01)
    if len(audio) > fade_in_samples * 2:
        fade_in = np.linspace(0, 1, fade_in_samples)
        audio[:fade_in_samples] *= fade_in

    fade_out_samples = int(sample_rate * 0.02)
    if len(audio) > fade_out_samples * 2:
        fade_out = np.linspace(1, 0, fade_out_samples)
        audio[-fade_out_samples:] *= fade_out

    return audio


class VibeVoice7BHandler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Expose-Headers", "Content-Length")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ready" if model else "loading",
                "model": model_name,
                "provider": "vibevoice7b",
                "workers": WORKERS,
                "voices": DEFAULT_VOICES,
                "cfg_scale": CFG_SCALE,
                "diffusion_steps": DIFFUSION_STEPS,
                "diffusion_steps_fast": DIFFUSION_STEPS_FAST,
                "diffusion_warmup_frames": DIFFUSION_WARMUP_FRAMES,
                "max_new_tokens": MAX_NEW_TOKENS,
                "note": "Voice cloning via reference_audio_path field"
            }).encode())

        elif path == "/voices":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({"voices": DEFAULT_VOICES}).encode())

        elif path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({
                "service": "VibeVoice-7B TTS Server",
                "version": "1.0.0",
                "model": model_name,
                "runtime": "appautomaton/mlx-speech",
                "endpoints": {
                    "health": "/health",
                    "voices": "/voices",
                    "tts": "POST /v1/audio/speech"
                },
                "notes": [
                    "Supports multi-speaker: use 'Speaker 0:', 'Speaker 1:' prefixes in text",
                    "Voice cloning: pass 'reference_audio_path' field with WAV path",
                    "Up to 4 speakers supported with reference audio"
                ]
            }).encode())

        else:
            self.send_response(404)
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Not found"}).encode())

    def do_POST(self):
        if self.path != "/v1/audio/speech":
            self.send_response(404)
            self._cors()
            self.end_headers()
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body.decode("utf-8"))
        except Exception:
            self.send_error(400, "Invalid JSON")
            return

        text = data.get("input", "").strip()
        voice = data.get("voice", "en-Emma_woman")
        reference_audio_path = data.get("reference_audio_path", None)
        reference_audio_data = data.get("reference_audio_data", None)

        if not text:
            self.send_error(400, "Text is required")
            return

        print(f"[TTS] Request: '{text[:50]}...'", flush=True)

        try:
            audio, sample_rate = generate_audio(text, voice, reference_audio_path, reference_audio_data)
            audio = post_process_audio(audio, sample_rate)

            audio_int16 = (audio * 32767).astype(np.int16)

            buffer = io.BytesIO()
            with wave.open(buffer, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(audio_int16.tobytes())

            audio_data = buffer.getvalue()

            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio_data)))
            self._cors()
            self.end_headers()
            self.wfile.write(audio_data)
            print(f"[TTS] Sent {len(audio_data)} bytes", flush=True)

        except Exception as e:
            print(f"[TTS Error] {e}", flush=True)
            self.send_error(500, str(e))

    def log_message(self, format, *args):
        print(f"[HTTP] {args[0]}", flush=True)


def main():
    global DEFAULT_PORT, DEFAULT_MODEL_DIR, CFG_SCALE, DIFFUSION_STEPS
    global DIFFUSION_STEPS_FAST, DIFFUSION_WARMUP_FRAMES, MAX_NEW_TOKENS, SEED

    parser = argparse.ArgumentParser(description="VibeVoice-7B TTS Server")
    parser.add_argument('--port', type=int, default=DEFAULT_PORT,
                        help=f"Puerto (default: {DEFAULT_PORT})")
    parser.add_argument('--model-dir', type=str, default=DEFAULT_MODEL_DIR,
                        help="Directorio local del modelo (default: auto-download)")
    parser.add_argument('--cfg-scale', type=float, default=CFG_SCALE,
                        help=f"Classifier-free guidance scale (default: {CFG_SCALE})")
    parser.add_argument('--diffusion-steps', type=int, default=DIFFUSION_STEPS,
                        help=f"Pasos de difusión (default: {DIFFUSION_STEPS})")
    parser.add_argument('--diffusion-steps-fast', type=int, default=DIFFUSION_STEPS_FAST,
                        help="Pasos de difusión rápidos para después del warmup")
    parser.add_argument('--diffusion-warmup-frames', type=int, default=DIFFUSION_WARMUP_FRAMES,
                        help=f"Warmup frames (default: {DIFFUSION_WARMUP_FRAMES})")
    parser.add_argument('--max-new-tokens', type=int, default=MAX_NEW_TOKENS,
                        help=f"Máximo de tokens de speech (default: {MAX_NEW_TOKENS})")
    parser.add_argument('--seed', type=int, default=SEED,
                        help=f"RNG seed (default: {SEED})")
    parser.add_argument('--reload', action='store_true',
                        help="Auto-reload (desarrollo)")

    args = parser.parse_args()
    CFG_SCALE = args.cfg_scale
    DIFFUSION_STEPS = args.diffusion_steps
    DIFFUSION_STEPS_FAST = args.diffusion_steps_fast
    DIFFUSION_WARMUP_FRAMES = args.diffusion_warmup_frames
    MAX_NEW_TOKENS = args.max_new_tokens
    SEED = args.seed
    model_dir = args.model_dir

    print("=" * 60, flush=True)
    print("VibeVoice-7B TTS Server v1.0.0", flush=True)
    print("Runtime: appautomaton/mlx-speech (MLX-native)", flush=True)
    print("=" * 60, flush=True)
    print(f"Puerto:                 {args.port}", flush=True)
    print(f"cfg_scale:              {CFG_SCALE}", flush=True)
    print(f"diffusion_steps:        {DIFFUSION_STEPS}", flush=True)
    print(f"diffusion_steps_fast:   {DIFFUSION_STEPS_FAST}", flush=True)
    print(f"diffusion_warmup_frames: {DIFFUSION_WARMUP_FRAMES}", flush=True)
    print(f"max_new_tokens:         {MAX_NEW_TOKENS}", flush=True)
    print(f"seed:                   {SEED}", flush=True)
    print("=" * 60, flush=True)

    load_model_once(args.model_dir)

    server = HTTPServer(('0.0.0.0', args.port), VibeVoice7BHandler)
    print(f"Server ready on port {args.port}", flush=True)
    print("Endpoints:", flush=True)
    print("  GET  /health           - Health check", flush=True)
    print("  GET  /voices           - List available voices", flush=True)
    print("  POST /v1/audio/speech  - Generate audio", flush=True)
    print("Notes:", flush=True)
    print("  Multi-speaker: 'Speaker 0: text\\nSpeaker 1: text'", flush=True)
    print("  Voice clone: 'reference_audio_path' field with WAV path", flush=True)
    print("=" * 60, flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
