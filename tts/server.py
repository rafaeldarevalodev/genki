#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genki Sensei - Piper TTS Server
Puerto: 8080
"""

import argparse
import json
import os
import sys
import socket
import wave
import io
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

DEFAULT_PORT = 8080
DEFAULT_MODEL = "en_GB-alan-medium"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(SCRIPT_DIR, "models")

AVAILABLE_MODELS = {
    # English UK
    "en_GB-alan-medium": os.path.join(MODELS_DIR, "en_GB-alan-medium.onnx"),
    "en_GB-semaine-medium": os.path.join(MODELS_DIR, "en_GB-semaine-medium.onnx"),
    # English US - High Quality
    "en_US-lessac-high": os.path.join(MODELS_DIR, "en_US-lessac-high.onnx"),
    "en_US-ryan-high": os.path.join(MODELS_DIR, "en_US-ryan-high.onnx"),
    # English US - Medium
    "en_US-lessac-medium": os.path.join(MODELS_DIR, "en_US-lessac-medium.onnx"),
    # Spanish
    "es_MX-claude-high": os.path.join(MODELS_DIR, "es_MX-claude-high.onnx"),
}

# Cache de voces cargadas
voice_cache = {}


def load_voice(model_path: str):
    """Cargar una voz (con cache)"""
    if model_path not in voice_cache:
        from piper.voice import PiperVoice
        voice_cache[model_path] = PiperVoice.load(model_path)
    return voice_cache[model_path]


def synthesize_wav(text: str, model_path: str) -> bytes:
    """Sintetizar texto a audio WAV"""
    voice = load_voice(model_path)
    config = voice.config
    
    # Sintetizar y recolectar AudioChunk
    audio_chunks = list(voice.synthesize(text))
    
    # Convertir a WAV usando audio_int16_bytes
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(config.sample_rate)
        
        for chunk in audio_chunks:
            # Usar audio_int16_bytes si está disponible, sino convertir
            if chunk._audio_int16_bytes:
                wav_file.writeframes(chunk._audio_int16_bytes)
            else:
                # Convertir float a int16
                import numpy as np
                audio_int16 = (chunk.audio_float_array * 32767).astype(np.int16)
                wav_file.writeframes(audio_int16.tobytes())
    
    return buffer.getvalue()


class PiperTTSHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[TTS] {self.address_string()} - {format % args}")

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors_headers()
            self.end_headers()
            response = {
                "status": "ok",
                "models": {name: os.path.exists(path) for name, path in AVAILABLE_MODELS.items()},
                "default": DEFAULT_MODEL
            }
            self.wfile.write(json.dumps(response).encode())
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/tts":
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        
        try:
            data = json.loads(body.decode("utf-8"))
        except:
            self.send_error(400, "Invalid JSON")
            return

        text = data.get("text", "").strip()
        model = data.get("voice", DEFAULT_MODEL)

        if not text:
            self.send_error(400, "Text is required")
            return

        model_path = AVAILABLE_MODELS.get(model)
        if not model_path or not os.path.exists(model_path):
            self.send_error(400, f"Model '{model}' not found")
            return

        try:
            print(f"[TTS] Synthesizing: '{text[:50]}...' with {model}", flush=True)
            audio_data = synthesize_wav(text, model_path)
            print(f"[TTS] Generated {len(audio_data)} bytes", flush=True)
            
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Transfer-Encoding", "binary")
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(audio_data)
        except Exception as e:
            print(f"[TTS Error] {e}")
            self.send_error(500, str(e))


def find_free_port(start_port=DEFAULT_PORT):
    for port in range(start_port, start_port + 100):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("localhost", port))
                return port
        except OSError:
            continue
    raise RuntimeError("No se encontró puerto libre")


def run_server(port=DEFAULT_PORT):
    if not os.path.exists(MODELS_DIR):
        os.makedirs(MODELS_DIR, exist_ok=True)

    try:
        from piper.voice import PiperVoice
    except ImportError:
        print("❌ Error: piper no está instalado")
        print("   Ejecuta: pip install piper-tts")
        sys.exit(1)

    models_installed = [m for m, p in AVAILABLE_MODELS.items() if os.path.exists(p)]
    actual_port = find_free_port(port)

    print(f"========================================")
    print(f"Genki Sensei - TTS Server")
    print(f"========================================")
    print(f"  Puerto: http://localhost:{actual_port}")
    print(f"  Modelos: {', '.join(models_installed) if models_installed else 'ninguno'}")
    print(f"  Por defecto: {DEFAULT_MODEL}")
    print(f"")
    print(f"Endpoints:")
    print(f"  GET  /health   - Health check")
    print(f"  POST /tts     - Generar audio")
    print(f"")
    print(f"Presiona Ctrl+C para detener")
    print(f"========================================")

    server = HTTPServer(("localhost", actual_port), PiperTTSHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Deteniendo servidor...")
        server.shutdown()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("-p", "--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()
    run_server(args.port)