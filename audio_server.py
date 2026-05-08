#!/usr/bin/env python3
"""Genki Voxtral TTS Server v2 - Port 8000"""
import os
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

import io
import json
import wave
import sys
import threading
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

DEFAULT_PORT = 8000

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = "/Users/rafael/Developer/labs/genki"
MODEL_PATH = os.path.join(PROJECT_DIR, "models", "Voxtral-4B-TTS")
VOICE_EMBEDDING_PATH = f"{MODEL_PATH}/voice_embedding"
WORKERS = 2

# Clean voice names (no emotion mapping)
VOICES = [
    "casual_female",
    "casual_male", 
    "cheerful_female",
    "neutral_female",
    "neutral_male",
]

model = None
model_lock = threading.Lock()

def load_model_once():
    global model
    print("[INIT] Loading Voxtral model...", flush=True)
    
    import mlx.core as mlx_core
    mlx_core.Stream.default = lambda: None
    
    from mlx_audio.tts import load_model
    model = load_model(MODEL_PATH, trust_remote_code=True)
    print("[INIT] Model loaded successfully", flush=True)
    return model

def generate_audio(text: str, voice: str = "neutral_male"):
    global model
    
    if model is None:
        raise Exception("Model not loaded")
    
    voice_id = voice
    
    # Generate with minimal parameters - let model do its thing
    with model_lock:
        result = model.generate(
            text, 
            voice=voice_id,
            temperature=0.2,
            top_k=45,
            top_p=0.85,
            max_tokens=4096
        )

       
        
        audio_chunks = []
        sample_rate = 24000
        
        for chunk in result:
            if hasattr(chunk, 'audio'):
                audio_chunks.append(chunk.audio)
                if hasattr(chunk, 'sample_rate'):
                    sample_rate = chunk.sample_rate
            elif hasattr(chunk, 'audio_float_array'):
                audio_chunks.append(chunk.audio_float_array())
        
        if not audio_chunks:
            raise Exception("No audio generated")
        
        audio = np.concatenate(audio_chunks)
        
        # Simple peak normalization only - no post-processing
        if audio.max() > 1.0:
            audio = audio / audio.max()
        
        return audio, sample_rate


def post_process_audio(audio: np.ndarray, sample_rate: int = 24000, threshold: float = 0.005) -> np.ndarray:
    """Remove low-energy artifacts, apply fades, and normalize audio."""
    
    if len(audio) == 0:
        return audio
    
    # 1. Calculate energy envelope
    energy = np.abs(audio)
    
    # 2. Remove silent/low-energy segments at start
    # Find first sample above threshold
    onset_indices = np.where(energy > threshold)[0]
    if len(onset_indices) > 0:
        start_idx = onset_indices[0]
        # Also remove any artifact before a clear onset (within 50ms)
        if start_idx > sample_rate * 0.05:
            start_idx = max(0, start_idx - int(sample_rate * 0.01))
        audio = audio[start_idx:]
    else:
        return audio
    
    # 3. Remove silent/low-energy at end
    energy = np.abs(audio)
    offset_indices = np.where(energy > threshold)[0]
    if len(offset_indices) > 0:
        end_idx = offset_indices[-1]
        # Keep a small tail for natural decay (50ms)
        end_idx = min(len(audio), end_idx + int(sample_rate * 0.05))
        audio = audio[:end_idx]
    
    if len(audio) < 100:
        return audio
    
    # 4. Soft fade in (10ms)
    fade_samples = int(sample_rate * 0.01)  # 10ms
    if len(audio) > fade_samples * 2:
        fade_in = np.linspace(0, 1, fade_samples)
        audio[:fade_samples] *= fade_in
    
    # 5. Soft fade out (50ms for natural ending)
    fade_samples_out = int(sample_rate * 0.05)  # 50ms
    if len(audio) > fade_samples_out * 2:
        fade_out = np.linspace(1, 0, fade_samples_out)
        audio[-fade_samples_out:] *= fade_out
    
    # 6. Soft clip to prevent hard peaks
    max_val = np.max(np.abs(audio))
    if max_val > 0.95:
        # Soft knee compression
        threshold_val = 0.9
        mask = np.abs(audio) > threshold_val
        if mask.any():
            excess = (np.abs(audio) - threshold_val) / (max_val - threshold_val + 0.001)
            excess = np.clip(excess, 0, 1)
            sign = np.sign(audio)
            audio = sign * (threshold_val + excess * (1 - threshold_val))
    
    # 7. Final normalization
    if audio.max() > 1.0 or audio.min() < -1.0:
        audio = audio / np.max(np.abs(audio))
    
    return audio

class VoxtralTTSHandler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            
            self.wfile.write(json.dumps({
                "status": "ready" if model else "loading",
                "model": "voxtral-4b-tts",
                "workers": WORKERS,
                "voices": VOICES
            }).encode())
            
        elif self.path == "/voices":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({"voices": VOICES}).encode())
        
        else:
            self.send_response(404)
        self.end_headers()

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
        except:
            self.send_error(400, "Invalid JSON")
            return

        text = data.get("input", "").strip()
        voice = data.get("voice", "neutral_male")
        
        if not text:
            self.send_error(400, "Text is required")
            return
        
        # Use provided voice directly
        selected_voice = voice if voice else "neutral_male"
        
        print(f"[TTS] Generating: '{text[:30]}' voice={selected_voice}", flush=True)

        try:
            audio, sample_rate = generate_audio(text, selected_voice)
            
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
            print(f"[TTS] Generated {len(audio_data)} bytes", flush=True)
            
        except Exception as e:
            print(f"[TTS Error] {e}", flush=True)
            self.send_error(500, str(e))

def main():
    load_model_once()
    
    server = HTTPServer(('0.0.0.0', DEFAULT_PORT), VoxtralTTSHandler)
    print(f"Voxtral TTS Server ready on port {DEFAULT_PORT}", flush=True)
    print(f"Workers: {WORKERS}", flush=True)
    server.serve_forever()

if __name__ == "__main__":
    main()