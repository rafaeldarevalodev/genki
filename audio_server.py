#!/usr/bin/env python3
"""Genki Voxtral TTS Server - Port 8000"""
import os
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

import io
import json
import wave
import subprocess
import numpy as np
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import sys

DEFAULT_PORT = 8000
MODEL_PATH = "/Volumes/Rafa HD/Freelances/genki/models/Voxtral-4B-TTS"

VOICE_MAP = {
    "en_us_aria": "casual_female",
    "en_us_james": "casual_male", 
    "en_us_zoe": "cheerful_female",
    "en_gb_sophie": "neutral_female",
    "en_gb_oliver": "neutral_male",
}

EMOTION = {
    "neutral": "Speak in a neutral tone.",
    "cheerful": "Speak with a cheerful tone.",
    "empathetic": "Speak with an empathetic tone.",
    "excited": "Speak with an excited tone.",
}

def generate_audio(text, voice, emotion):
    prompt = f"{EMOTION.get(emotion, EMOTION['neutral'])} {text}"
    
    script = f'''#!/usr/bin/env python3
import os
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

import sys
import numpy as np

try:
    import mlx.core as mlx_core
    if hasattr(mlx_core, 'Stream'):
        mlx_core.Stream.default = lambda: None

    from mlx_audio.tts import load_model

    model = load_model("{MODEL_PATH}", trust_remote_code=True)
    result = model.generate("{prompt}", voice="{voice}")

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
        print("ERROR: No audio", file=sys.stderr)
        sys.exit(1)
    
    full = np.concatenate(audio_chunks)
    if full.max() > 1.0:
        full = full / full.max()
    
    with open('/tmp/genki_audio.bin', 'wb') as f:
        f.write(full.tobytes())
    with open('/tmp/genki_sr.txt', 'w') as f:
        f.write(str(sample_rate))
    
    print("OK", file=sys.stderr)
except Exception as e:
    print(f"ERROR: {{e}}", file=sys.stderr)
    import traceback
    traceback.print_exc()
    sys.exit(1)
'''
    
    with open('/tmp/genki_tts.py', 'w') as f:
        f.write(script)
    
    print(f"[SERVER] Spawning subprocess for: {text[:20]}...", flush=True)
    
    proc = subprocess.run(
        ['conda', 'run', '-n', 'voxtral_audio', 'python', '/tmp/genki_tts.py'],
        capture_output=True,
        text=True,
        timeout=120
    )
    
    print(f"[SERVER] Subprocess done: {proc.returncode}", flush=True)
    
    if proc.returncode != 0:
        raise Exception(f"Failed: {proc.stderr}")
    
    audio = np.fromfile('/tmp/genki_audio.bin', dtype=np.float32)
    with open('/tmp/genki_sr.txt', 'r') as f:
        sample_rate = int(f.read())
    
    return audio, sample_rate

class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ready",
                "model": "voxtral-4b-tts",
                "voices": list(VOICE_MAP.keys()),
                "emotions": list(EMOTION.keys())
            }).encode())
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
        voice_id = data.get("voice", "en_us_aria")
        emotion = data.get("emotion", "neutral")
        
        if not text:
            self.send_error(400, "Text is required")
            return

        voice = VOICE_MAP.get(voice_id, VOICE_MAP["en_us_aria"])
        
        print(f"[TTS] Generating: '{text[:30]}' voice={voice_id}")

        try:
            audio, sample_rate = generate_audio(text, voice, emotion)
            
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
            print(f"[TTS] Generated {len(audio_data)} bytes")
            
        except Exception as e:
            print(f"[TTS Error] {e}", flush=True)
            import traceback
            traceback.print_exc()
            self.send_error(500, str(e))

def main():
    print("Voxtral TTS Server starting...", flush=True)
    server = HTTPServer(('0.0.0.0', DEFAULT_PORT), Handler)
    print(f"Voxtral TTS Server ready on port {DEFAULT_PORT}", flush=True)
    server.serve_forever()

if __name__ == "__main__":
    main()