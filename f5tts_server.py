#!/usr/bin/env python3
"""
F5-TTS HTTP Server - Expose F5-TTS as REST API
Compatible with the standard TTS API format used by Kokoro
"""

import os
import sys
import io
import json
import time
import wave
import base64
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

# Configuration
DEFAULT_PORT = 8093
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPT_DIR = PROJECT_DIR
REFERENCE_VOICES_DIR = os.path.join(SCRIPT_DIR, "reference_voices")

# Voice mapping
VOICES = [
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

# Voice to reference file mapping (24kHz versions for F5-TTS)
VOICE_TO_REFERENCE = {
    "en-Emma_woman": "en_Emma_woman.wav",
    "en-Davis_man": "en_Davis_man.wav",
    "en-Carter_man": "en_Carter_man.wav",
    "en-Grace_woman": "en_Grace_woman.wav",
    "en-Mike_man": "en_Mike_man.wav",
    "en-Frank_man": "en_Frank_man.wav",
    "en-Sara_woman": "en_Sara_woman_24k.wav",
    "en-Max_man": "en_Max_man_24k.wav",
    "en-July_Sexy_woman": "en_July_Sexy_woman_24k.wav",
    "en-Jane_woman": "en_Jane_woman_24k.wav",
    "en-Giuseppe_man": "en_Giuseppe_man_24k.wav",
    "en-Andi_Male": "en_Andi_Male_24k.wav",
    "en-Lady_female": "en_Lady_female_24k.wav",
    "en-Hanel_male": "en_Hanel_male_24k.wav",
    "en-Mark_Eng": "en_Mark_Eng_24k.wav",
}

# Reference text for each voice (transcribed with Whisper)
VOICE_TO_REF_TEXT = {
    "en-Emma_woman": "Clearly this is my face is unnatural and express me.",
    "en-Davis_man": "Some call me nature, others call me mother nature.",
    "en-Carter_man": "Some call me nature, others call me mother nature.",
    "en-Grace_woman": "Clearly this is my face is unnatural and express me.",
    "en-Mike_man": "Some call me nature, others call me mother nature.",
    "en-Frank_man": "Some call me nature, others call me mother nature.",
    "en-Sara_woman": "Clearly this is my face is unnatural and express me.",
    "en-Max_man": "Some call me nature, others call me mother nature.",
    "en-July_Sexy_woman": "Clearly this is my face is unnatural and express me.",
    "en-Jane_woman": "Clearly this is my face is unnatural and express me.",
    "en-Giuseppe_man": "Some call me nature, others call me mother nature.",
    "en-Andi_Male": "Some call me nature, others call me mother nature.",
    "en-Lady_female": "Clearly this is my face is unnatural and express me.",
    "en-Hanel_male": "Some call me nature, others call me mother nature.",
    "en-Mark_Eng": "Some call me nature, others call me mother nature.",
}

# Model loaded flag
model_loaded = False
model_lock = threading.Lock()


class F5TTSHandler(BaseHTTPRequestHandler):
    """HTTP handler for F5-TTS requests."""
    
    def log_message(self, format, *args):
        """Override to customize logging."""
        print(f"[F5-TTS HTTP] {args[0]}", flush=True)
    
    def _cors(self):
        """Add CORS headers."""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    
    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self._cors()
        self.end_headers()
    
    def do_GET(self):
        """Health check endpoint."""
        if self.path in ["/health", "/status", "/voices", "/v1/audio/voices"]:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._cors()
            self.end_headers()
            
            if "/voices" in self.path:
                self.wfile.write(json.dumps({"voices": VOICES}).encode())
            else:
                self.wfile.write(json.dumps({
                    "status": "ready" if model_loaded else "loading",
                    "model": "f5-tts",
                    "voices": VOICES
                }).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        """Generate speech."""
        if self.path not in ["/v1/audio/speech", "/tts"]:
            self.send_response(404)
            self._cors()
            self.end_headers()
            return
        
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self.send_error(400, "No body content")
            return
        
        body = self.rfile.read(content_length)
        
        try:
            data = json.loads(body.decode('utf-8'))
        except:
            self.send_error(400, "Invalid JSON")
            return
        
        text = data.get("input", data.get("text", "")).strip()
        voice = data.get("voice", "en-Emma_woman").strip()
        speed = float(data.get("speed", 1.0))
        
        if not text:
            self.send_error(400, "Text is required")
            return
        
        print(f"[F5-TTS] RECEIVED text: '{text}'", flush=True)
        print(f"[F5-TTS] RECEIVED voice: '{voice}'", flush=True)
        print(f"[F5-TTS] Generating audio... speed={speed}", flush=True)
        
        try:
            # Generate audio
            audio_data = generate_f5tts(text, voice, speed)
            
            # Send response
            self.send_response(200)
            self.send_header('Content-Type', 'audio/wav')
            self._cors()
            self.end_headers()
            self.wfile.write(audio_data)
            
        except Exception as e:
            print(f"[F5-TTS Error] {e}", flush=True)
            import traceback
            traceback.print_exc()
            self.send_error(500, str(e))


def generate_f5tts(text: str, voice: str, speed: float = 1.0) -> bytes:
    """Generate audio using F5-TTS."""
    global model_loaded
    
    # Get reference audio path
    ref_file = VOICE_TO_REFERENCE.get(voice, "en_Emma_woman.wav")
    ref_path = os.path.join(REFERENCE_VOICES_DIR, ref_file)
    
    if not os.path.exists(ref_path):
        # Fallback to default
        ref_path = os.path.join(REFERENCE_VOICES_DIR, "en_Emma_woman.wav")
    
    ref_text = VOICE_TO_REF_TEXT.get(voice, "Some call me nature, others call me mother nature.")
    
    print(f"[F5-TTS] Using reference: {ref_path}", flush=True)
    print(f"[F5-TTS] Reference text: '{ref_text}'", flush=True)
    
    # Truncate reference audio to max 5 seconds to prevent F5-TTS issues
    import soundfile as sf
    ref_audio, ref_sr = sf.read(ref_path)
    max_samples = int(5 * ref_sr)  # 5 seconds max
    if len(ref_audio) > max_samples:
        print(f"[F5-TTS] Truncating reference from {len(ref_audio)/ref_sr:.2f}s to 5s", flush=True)
        ref_audio = ref_audio[:max_samples]
        # Save truncated version
        truncated_path = ref_path.replace('.wav', '_5s.wav')
        sf.write(truncated_path, ref_audio, ref_sr)
        ref_path = truncated_path
    
    # Import F5-TTS
    from f5_tts_mlx.generate import generate as f5_generate
    import numpy as np
    import tempfile
    
    # Split text by sentences to reduce hallucinations
    # Split by ., !, ? followed by space or end of string
    import re
    sentences = re.split(r'(?<=[.!?])\s+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    print(f"[F5-TTS] Split into {len(sentences)} sentences", flush=True)
    
    # Generate audio for each sentence and concatenate
    all_audio = []
    sample_rate = 24000
    
    for i, sentence in enumerate(sentences):
        print(f"[F5-TTS] Processing sentence {i+1}/{len(sentences)}: '{sentence[:50]}...'", flush=True)
        
        # Create temp file for this sentence
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_sentence:
            sentence_path = tmp_sentence.name
        
        try:
            f5_generate(
                generation_text=sentence,
                ref_audio_path=ref_path,
                ref_audio_text=ref_text,
                steps=32,
                speed=speed,
                output_path=sentence_path
            )
            
            # Load generated audio for this sentence
            sentence_audio, sr = sf.read(sentence_path)
            all_audio.append(sentence_audio)
            print(f"[F5-TTS] Sentence {i+1}: {len(sentence_audio)/sr:.2f}s", flush=True)
            
        finally:
            # Clean up temp file
            try:
                os.remove(sentence_path)
            except:
                pass
    
    # Concatenate all audio
    audio_np = np.concatenate(all_audio)
    sample_rate = sr
    print(f"[F5-TTS] Total generated {len(audio_np)/sample_rate:.2f}s of audio", flush=True)
    
    # Apply fade-in to prevent cut-off at start
    fade_samples = int(0.1 * sample_rate)  # 0.1 second fade-in
    if len(audio_np) > fade_samples:
        fade_curve = np.linspace(0, 1, fade_samples)
        audio_np[:fade_samples] = audio_np[:fade_samples] * fade_curve
    
    # Normalize if needed
    max_abs = np.abs(audio_np).max()
    if max_abs > 1.0:
        audio_np = audio_np / max_abs
    
    # Convert to int16
    audio_int16 = (audio_np * 32767).astype(np.int16)
    
    # Create WAV in memory
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_int16.tobytes())
    
    return buffer.getvalue()


def main():
    global DEFAULT_PORT
    
    import argparse
    parser = argparse.ArgumentParser(description="F5-TTS HTTP Server")
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help=f"Port (default: {DEFAULT_PORT})")
    args = parser.parse_args()
    
    server = HTTPServer(('0.0.0.0', args.port), F5TTSHandler)
    print(f"F5-TTS Server ready on port {args.port}")
    print(f"Endpoint: http://localhost:{args.port}/v1/audio/speech")
    print(f"Voices: {VOICES}", flush=True)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
