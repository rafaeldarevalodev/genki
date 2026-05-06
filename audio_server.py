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

# Voice mapping: emotion → voice embedding
# Each emotion uses a different voice for variety
EMOTION_VOICE = {
    "neutral": "neutral_male",      # Male voice for neutral
    "cheerful": "cheerful_female", # Female cheerful voice
    "excited": "casual_male",       # Male voice with energy
    "empathetic": "casual_female",  # Female soft voice
}

# All available voices in the model
ALL_VOICES = [
    "casual_female", "casual_male",
    "cheerful_female",
    "neutral_female", "neutral_male",
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
    
    # Generate with optimized parameters from Voxtral paper
    # lower temperature = more natural, less stuttered
    # top_k = 50 is default
    with model_lock:
        result = model.generate(
            text, 
            voice=voice_id,
            temperature=0.8,  # Lower temp for natural speech
            top_k=50,
            top_p=0.95,
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
                audio_chunks.append(chunk.audio_float_array)
        
        if not audio_chunks:
            raise Exception("No audio generated")
        
        audio = np.concatenate(audio_chunks)
        
        if audio.max() > 1.0:
            audio = audio / audio.max()
        
        return audio, sample_rate

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
                "emotions": list(EMOTION_VOICE.keys()),
                "voices": list(set(EMOTION_VOICE.values()))
            }).encode())
            
        elif self.path == "/voices":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({"emotion_voice": EMOTION_VOICE}).encode())
        
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
        emotion = data.get("emotion", "neutral")
        voice = data.get("voice", "")
        
        if not text:
            self.send_error(400, "Text is required")
            return

        # Use provided voice, or fall back to emotion-based voice
        if voice and voice in ALL_VOICES:
            selected_voice = voice
        else:
            selected_voice = EMOTION_VOICE.get(emotion, "neutral_male")
        
        print(f"[TTS] Generating: '{text[:30]}' emotion={emotion} voice={selected_voice}", flush=True)

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