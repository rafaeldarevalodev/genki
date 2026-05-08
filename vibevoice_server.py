#!/usr/bin/env python3
"""Genki VibeVoice TTS Server v3 - Port 8090

Servidor HTTP multi-hilo para síntesis de voz con Microsoft VibeVoice-Realtime-0.5B.
Optimizado para Apple Silicon (MLX) con Chunking Agresivo y Normalización Local.

Uso:
    python vibevoice_server.py
    python vibevoice_server.py --port 8090
"""

import os
# Evita advertencias de concurrencia en la tokenización
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

import io
import json
import wave
import re
import threading
import argparse
import numpy as np
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from typing import Optional

DEFAULT_PORT = 8090
DEFAULT_MODEL = "mlx-community/VibeVoice-Realtime-0.5B-4bit"

# Voces disponibles en el modelo
VOICES = [
    "en-Emma_woman",
    "en-Davis_man",
    "en-Carter_man",
    "en-Grace_woman",
    "en-Mike_man",
    "en-Frank_man",
    "en-July_Sexy_woman"
]

# Estado global
model = None
model_lock = threading.Lock()
model_name = DEFAULT_MODEL


def load_model_once(model_path: str = DEFAULT_MODEL) -> Optional[object]:
    """Carga el modelo MLX en memoria una sola vez al iniciar."""
    global model, model_name

    print(f"[INIT] Loading VibeVoice model: {model_path}", flush=True)
    
    import mlx.core as mx
    print(f"[INIT] MLX version: {mx.__version__}", flush=True)

    from mlx_audio.tts.utils import load_model

    loaded_model = load_model(model_path, trust_remote_code=True)
    model_name = model_path

    print("[INIT] Model loaded successfully", flush=True)

    model = {
        'instance': loaded_model,
        'model_path': model_path
    }
    return model


def split_text_into_chunks(text: str, max_chars: int = 180) -> list:
    """
    Divide el texto jerárquicamente para garantizar que ningún chunk 
    supere el límite de la ventana de contexto del modelo.
    """
    text = text.replace('\n', ' ').strip()
    
    # 1er Nivel: Cortar por puntuación fuerte
    raw_chunks = re.split(r'(?<=[.!?]) +', text)
    
    final_chunks = []
    for chunk in raw_chunks:
        chunk = chunk.strip()
        if not chunk: continue
        
        if len(chunk) <= max_chars:
            final_chunks.append(chunk)
        else:
            # 2do Nivel: Si es muy largo, cortamos por comas o punto y coma
            sub_chunks = re.split(r'(?<=[,;:]) +', chunk)
            current_sub = ""
            
            for sub in sub_chunks:
                if len(current_sub) + len(sub) <= max_chars:
                    current_sub += sub + " "
                else:
                    if current_sub:
                        final_chunks.append(current_sub.strip())
                    current_sub = sub + " "
            
            if current_sub.strip():
                final_chunks.append(current_sub.strip())
                
    return final_chunks


def generate_audio(text: str, voice: str = "en-Emma_woman") -> tuple:
    """Genera audio aplicando normalización local por chunk y concurrencia segura."""
    global model

    if model is None:
        raise Exception("Model not loaded")

    selected_voice = voice if voice in VOICES else VOICES[0]
    
    text_chunks = split_text_into_chunks(text)
    print(f"[TTS] Processing {len(text_chunks)} chunks for voice={selected_voice}", flush=True)

    all_audio_chunks = []
    sample_rate = 24000

    try:
        # El lock garantiza que múltiples peticiones HTTP no corrompan la inferencia en GPU
        with model_lock:
            for i, chunk_text in enumerate(text_chunks):
                if not chunk_text.strip(): 
                    continue
                
                result = model['instance'].generate(
                    text=chunk_text,
                    voice=selected_voice,
                    cfg_scale=2.5,  # Guía fuerte para seguir el texto
                    ddpm_steps=25   # Reduce estática de difusión
                )

                sample_rate = model['instance'].sample_rate or 24000
                
                chunk_audio_arrays = []
                
                # Consumimos el generador iterativo
                for chunk in result:
                    if hasattr(chunk, 'audio'):
                        chunk_audio = chunk.audio
                        chunk_np = np.array(chunk_audio.tolist()) if hasattr(chunk_audio, 'tolist') else np.array(chunk_audio)
                        
                        if chunk_np.ndim > 1: 
                            chunk_np = chunk_np.flatten()
                            
                        chunk_audio_arrays.append(chunk_np)
                
                if chunk_audio_arrays:
                    # Unimos las partes de ESTA oración
                    sentence_audio = np.concatenate(chunk_audio_arrays)
                    
                    # NORMALIZACIÓN LOCAL: Garantiza volumen constante en cada bloque
                    max_abs = np.max(np.abs(sentence_audio))
                    if max_abs > 0.0:
                        sentence_audio = (sentence_audio / max_abs) * 0.95
                        
                    all_audio_chunks.append(sentence_audio)
                
                # Pausa natural entre oraciones para mejor prosodia
                if i < len(text_chunks) - 1:
                    silence = np.zeros(int(sample_rate * 0.25))
                    all_audio_chunks.append(silence)

        if not all_audio_chunks:
            raise Exception("No audio generated")

        # Ensamblaje final de todos los bloques ya normalizados
        audio = np.concatenate(all_audio_chunks)

        return audio, sample_rate

    except Exception as e:
        print(f"[TTS Error] Generation failed: {e}", flush=True)
        raise


class VibeVoiceHandler(BaseHTTPRequestHandler):
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
                "provider": "vibevoice",
                "voices": VOICES
            }).encode())
            
        elif path == "/voices":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({"voices": VOICES}).encode())
        
        elif path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({
                "service": "VibeVoice TTS Server",
                "version": "3.0.0",
                "model": model_name,
                "endpoints": {
                    "health": "GET /health",
                    "voices": "GET /voices",
                    "tts": "POST /v1/audio/speech"
                }
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
        except:
            self.send_error(400, "Invalid JSON")
            return

        text = data.get("input", "").strip()
        voice = data.get("voice", "en-Emma_woman")
        
        if not text:
            self.send_error(400, "Text is required")
            return
        
        print(f"[HTTP] POST /v1/audio/speech | Text: '{text[:30]}...' | Voice: {voice}", flush=True)

        try:
            # Procesamiento de inferencia
            audio, sample_rate = generate_audio(text, voice)
            
            # Conversión PCM 16-bit para compatibilidad WAV
            audio_int16 = (audio * 32767).astype(np.int16)
            
            buffer = io.BytesIO()
            with wave.open(buffer, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2) # 2 bytes = 16 bits
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(audio_int16.tobytes())
            
            audio_data = buffer.getvalue()
            
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio_data)))
            self._cors()
            self.end_headers()
            self.wfile.write(audio_data)
            print(f"[HTTP] Generated {len(audio_data)} bytes successfully", flush=True)
            
        except Exception as e:
            print(f"[HTTP Error] {e}", flush=True)
            self.send_error(500, str(e))

    def log_message(self, format, *args):
        # Silencia los logs automáticos para mantener la consola limpia
        pass


def main():
    parser = argparse.ArgumentParser(description="VibeVoice TTS Server")
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help=f"Puerto (default: {DEFAULT_PORT})")
    parser.add_argument('--model', type=str, default=DEFAULT_MODEL, help=f"Modelo MLX (default: {DEFAULT_MODEL})")
    
    args = parser.parse_args()
    
    print("=" * 60, flush=True)
    print(" VibeVoice TTS Server (v3 Optimized)", flush=True)
    print("=" * 60, flush=True)
    print(f" Puerto: {args.port}", flush=True)
    print(f" Modelo: {args.model}", flush=True)
    print("=" * 60, flush=True)
    
    load_model_once(args.model)
    
    # ThreadingHTTPServer despacha cada petición en un hilo nuevo,
    # el model_lock sincroniza el acceso a la GPU.
    server = ThreadingHTTPServer(('0.0.0.0', args.port), VibeVoiceHandler)
    print(f"\n[INFO] Server ready on http://localhost:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()