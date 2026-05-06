#!/usr/bin/env python3
"""Genki Kokoro TTS Server - Port 8880"""
import os
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

import io
import json
import wave
import numpy as np
from http.server import HTTPServer, BaseHTTPRequestHandler

DEFAULT_PORT = 8880

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = "/Users/rafael/Developer/labs/genki"
MODEL_PATH = os.path.join(PROJECT_DIR, "models", "kokoro", "kokoro-v1.0.onnx")
VOICES_PATH = os.path.join(PROJECT_DIR, "models", "kokoro", "voices-v1.0.bin")

# Voice mapping for UI - select most common voices
VOICES = [
    "af_bella", "af_heart", "af_sky", "af_sarah", "af_nova",
    "am_adam", "am_onyx", "am_puck",
    "bm_george", "bm_lewis",
]

pipeline = None
sample_rate = 24000

def load_model():
    global pipeline, sample_rate
    print("[INIT] Loading Kokoro model...", flush=True)
    
    from kokoro_tts import Kokoro
    
    pipeline = Kokoro(
        model_path=MODEL_PATH,
        voices_path=VOICES_PATH,
    )
    print("[INIT] Kokoro model loaded successfully", flush=True)
    return pipeline

class KokoroTTSHandler(BaseHTTPRequestHandler):
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
            self.wfile.write(json.dumps({"status": "ready" if pipeline else "loading"}).encode())
        
        elif self.path in ["/voices", "/v1/audio/voices"]:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({"voices": VOICES}).encode())
        
        elif self.path == "/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ready" if pipeline else "loading",
                "model": "kokoro-82m",
                "voices": VOICES
            }).encode())
        
        else:
            self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path not in ["/v1/audio/speech", "/tts"]:
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

        text = data.get("input", data.get("text", "")).strip()
        voice = data.get("voice", "af_bella").strip()
        speed = float(data.get("speed", 1.0))
        lang = data.get("lang", "en-us")
        
        if not text:
            self.send_error(400, "Text is required")
            return

        print(f"[TTS] Generating: '{text[:30]}' voice={voice} speed={speed}", flush=True)

        try:
            if pipeline is None:
                load_model()

            # Generate audio - use create method
            result = pipeline.create(text, voice=voice, speed=speed, lang=lang)
            
            if isinstance(result, tuple):
                audio, sr = result
            else:
                audio = result
                sr = sample_rate
            
            # Ensure we have a valid audio array
            if hasattr(audio, 'numpy'):
                audio = audio.numpy()
            
            audio = audio.flatten()
            
            # Normalize to int16
            if audio.max() > 1.0:
                audio = audio / np.abs(audio).max()
            audio_int16 = (audio * 32767).astype(np.int16)
            
            # Create WAV
            buffer = io.BytesIO()
            with wave.open(buffer, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(sr)
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
            import traceback
            traceback.print_exc()
            self.send_error(500, str(e))

def main():
    global pipeline
    load_model()
    
    server = HTTPServer(('0.0.0.0', DEFAULT_PORT), KokoroTTSHandler)
    print(f"Kokoro TTS Server ready on port {DEFAULT_PORT}", flush=True)
    server.serve_forever()

if __name__ == "__main__":
    main()