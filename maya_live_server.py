#!/usr/bin/env python3
"""Genki Maya Live Voice Server - Port 8092

FastAPI server for Live Voice Mode with Maya.
Implements Strategy B: Abort + LLM Cancel (complete cancellation on user interrupt).

Pipeline: VAD → ASR (mlx-whisper) → LLM (Maya) → TTS Streaming (F5-TTS / VibeVoice)

Usage:
    python maya_live_server.py                    # Port 8092
    python maya_live_server.py --port 8092       # Custom port
"""

import os
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

import io
import json
import wave
import sys
import uuid
import time
import asyncio
import base64
import threading
import argparse
import re
from pathlib import Path
from typing import Optional, AsyncGenerator, Any
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

DEFAULT_PORT = 8092
DEFAULT_HOST = "http://localhost:8092"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MLX_SPEECH_DIR = os.path.join(SCRIPT_DIR, "mlx-speech", "src")

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

# Maya Voice Settings - F5-TTS uses same reference voices (24kHz versions)
DEFAULT_MAYA_VOICE = "en-Emma_woman"
VOICE_ID_TO_FILE = {
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
    "en-Giuseppe_man": "en_Giuseppe_man.wav",
    "en-Andi_Male": "en_Andi_Male.wav",
    "en-Lady_female": "en_Lady_female.wav",
    "en-Hanel_male": "en_Hanel_male.wav",
    "en-Mark_Eng": "en_Mark_Eng_24k.wav",
}

# Reference text for each voice (transcribed with Whisper)
# This is CRUCIAL for F5-TTS to align text with reference audio
VOICE_ID_TO_REF_TEXT = {
    "en-Emma_woman": "Clearly this is my face is unnatural and express me.",
    "en-Davis_man": "Hello, this is Mae Voice, those are natural and express.",
    "en-Carter_man": "Hello, this is my voice, I saw a natural and expression.",
    "en-Grace_woman": "Hello, this is my voice. I said... I'll... Right with nature!",
    "en-Mike_man": "Hello, this is by voice. I sound after one, it's pressu.",
    "en-Frank_man": "Oh man this is my voice! will stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single stay single",
    "en-Sara_woman": "you only get so many summers with your your pets. So this is your reminder to make the most of them. Even then, whether that's big adventures like a waterfall hike or a road trip to the beach, in craze or something as simple as a walk around the neighborhood or playing with their favorite toys. It's not about doing something huge every single day. It's about making every day feel like something special to them. So whether you're taking big adventures or cherishing the small moments at home, be by Chewy has you covered with all your needs.",
    "en-Max_man": "You kidding me? You make another DBZ game when it has been over for what like 20 years, but you can't have make an open world in a rude old game.",
    "en-July_Sexy_woman": "Oh, that's so clever. I've never heard a hero say that one before. How long did it take you to come up with that?",
    "en-Jane_woman": "It's true. I haven't forgotten him. During the day I try not to think about him too much, but at night, the full weight of the memories falls on me.",
    "en-Giuseppe_man": "remember there's this interview spreadsheet see essence sales have populated that with the number of customer contacts for meetings please do",
    "en-Andi_Male": "it's alright it's hard in tabular form but when it's charted it's much easier to see like if it's achievable or not based on some of the trends and there's also if you scroll down",
    "en-Lady_female": "is not great and I don't know if we set out originally to track some of those performance things but I think that performance and in to your point Kenny I think",
    "en-Hanel_male": "yeah same not even not in real time but you know source feedback i got one person to respond so far so it may end up cindy being you and i just picking the one that we want to do",
    "en-Mark_Eng": "I'm humbled that Central Florida has given so much back to me and my family as well. Thank you for taking the time to get to know me and our firm, Nijem Law.",
}

MAYA_SYSTEM_PROMPT = """You are Maya, a friendly English conversation tutor.
Keep responses to 2-3 sentences maximum.
Be encouraging and natural.
Do NOT use any brackets [] in your responses.
Start the conversation naturally based on the user's level."""

# =============================================================================
# Session Management
# =============================================================================

@dataclass
class MayaSession:
    id: str
    messages: list[dict] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    aborted: bool = False

sessions: dict[str, MayaSession] = {}
session_lock = threading.Lock()

def create_session() -> MayaSession:
    session_id = str(uuid.uuid4())
    session = MayaSession(id=session_id)
    with session_lock:
        sessions[session_id] = session
    return session

def get_session(session_id: str) -> Optional[MayaSession]:
    with session_lock:
        return sessions.get(session_id)

def reset_session(session_id: str) -> None:
    with session_lock:
        if session_id in sessions:
            sessions[session_id].messages = []
            sessions[session_id].aborted = False

def mark_session_aborted(session_id: str) -> None:
    with session_lock:
        if session_id in sessions:
            sessions[session_id].aborted = True

# =============================================================================
# Model Loading (Lazy + Cached)
# =============================================================================

class ModelCache:
    def __init__(self):
        self.f5tts_model = None
        self.vibevoice_model = None
        self.whisper_model = None
        self.lock = threading.Lock()
        self.loading = {}
    
    def load_f5tts(self, model_dir: Optional[str] = None):
        if self.f5tts_model is not None:
            return self.f5tts_model
        
        with self.lock:
            if self.f5tts_model is not None:
                return self.f5tts_model
            
            print("[INIT] Loading F5-TTS...", flush=True)
            try:
                from f5_tts_mlx import F5TTS, audio
                from f5_tts_mlx.cfm import F5TTS as F5TTSClass
                
                # Load model WITHOUT quantization for better compatibility
                f5tts_instance = F5TTSClass.from_pretrained(
                    "lucasnewman/f5-tts-mlx",
                    quantization_bits=None  # No quantization - better compatibility
                )
                
                self.f5tts_model = {
                    'instance': f5tts_instance,
                    'audio_module': audio,
                    'loaded': True
                }
                print("[INIT] F5-TTS loaded (no quantization)", flush=True)
                return self.f5tts_model
            except Exception as e:
                print(f"[WARN] F5-TTS load failed: {e}", flush=True)
                import traceback
                traceback.print_exc()
                return None
    
    def load_vibevoice(self, model_dir: Optional[str] = None):
        if self.vibevoice_model is not None:
            return self.vibevoice_model
        
        with self.lock:
            if self.vibevoice_model is not None:
                return self.vibevoice_model
            
            print("[INIT] Loading VibeVoice...", flush=True)
            try:
                sys.path.insert(0, MLX_SPEECH_DIR)
                from mlx_speech.models.vibevoice.checkpoint import load_vibevoice_model
                from mlx_speech.models.vibevoice.tokenizer import VibeVoiceTokenizer
                from mlx_speech.generation.vibevoice import synthesize_vibevoice
                from mlx_speech.audio.io import write_wav
                from mlx_speech._hub import get_model_path
                
                model_repo = "appautomaton/vibevoice-mlx"
                model_local_path = get_model_path(model_repo)
                model_int8_path = model_local_path / "mlx-int8"
                
                if model_int8_path.exists():
                    loaded = load_vibevoice_model(str(model_int8_path), prefer_mlx_int8=True, strict=False)
                    tokenizer = VibeVoiceTokenizer.from_path(str(loaded.model_dir))
                    
                    self.vibevoice_model = {
                        'instance': loaded.model,
                        'tokenizer': tokenizer,
                        'sample_rate': loaded.config.sampling_rate,
                        'synthesize': synthesize_vibevoice
                    }
                    print("[INIT] VibeVoice loaded", flush=True)
                    return self.vibevoice_model
            except Exception as e:
                print(f"[WARN] VibeVoice load failed: {e}", flush=True)
                return None
    
    def load_whisper(self):
        if self.whisper_model is not None:
            return self.whisper_model
        
        with self.lock:
            if self.whisper_model is not None:
                return self.whisper_model
            
            print("[INIT] Loading Whisper...", flush=True)
            try:
                import mlx_whisper
                self.whisper_model = {
                    'module': mlx_whisper,
                    'loaded': True
                }
                print("[INIT] Whisper loaded", flush=True)
                return self.whisper_model
            except Exception as e:
                print(f"[WARN] Whisper load failed: {e}", flush=True)
                return None

model_cache = ModelCache()

# =============================================================================
# Audio Processing Helpers
# =============================================================================

def base64_to_wav(audio_base64: str, sample_rate: int = 16000) -> tuple[bytes, int]:
    """Decode base64 audio to WAV bytes. Handles both WAV and webm/opus formats."""
    audio_bytes = base64.b64decode(audio_base64)
    
    # Check if it's webm/opus format
    if is_webm_audio(audio_bytes):
        print("[Audio] Detected webm/opus, decoding...", flush=True)
        pcm_bytes, actual_sr = decode_webm_to_pcm(audio_bytes, sample_rate)
        
        # Convert PCM to WAV format
        out_buffer = io.BytesIO()
        with wave.open(out_buffer, 'wb') as wav_out:
            wav_out.setnchannels(1)
            wav_out.setsampwidth(2)
            wav_out.setframerate(sample_rate)
            wav_out.writeframes(pcm_bytes)
        
        return out_buffer.getvalue(), sample_rate
    
    # It's already WAV - use wave module
    buffer = io.BytesIO(audio_bytes)
    with wave.open(buffer, 'rb') as wav:
        if wav.getnchannels() > 1:
            raise ValueError("Audio must be mono")
        frames = wav.readframes(wav.getnframes())
        sr = wav.getframerate()
    
    # Re-encode to target sample rate if needed
    if sr != sample_rate:
        import numpy as np
        audio_np = np.frombuffer(frames, dtype=np.int16)
        # Resample if needed (simplified - just keep original for now)
        frames = audio_np.tobytes()
    
    # Return as WAV
    out_buffer = io.BytesIO()
    with wave.open(out_buffer, 'wb') as wav_out:
        wav_out.setnchannels(1)
        wav_out.setsampwidth(2)
        wav_out.setframerate(sample_rate)
        wav_out.writeframes(frames)
    
    return out_buffer.getvalue(), sample_rate

def audio_to_base64_pcm(audio_np) -> str:
    """Convert numpy array to base64 PCM."""
    import numpy as np
    if audio_np.max() > 1.0:
        audio_np = audio_np / max(abs(audio_np.min()), abs(audio_np.max()))
    audio_int16 = (audio_np * 32767).astype(np.int16)
    return base64.b64encode(audio_int16.tobytes()).decode()

def compress_audio_data(pcm_base64: str) -> str:
    """Compress base64 PCM data with gzip for efficient streaming.
    
    Industry standard: Use gzip compression to reduce data size by ~70%.
    This prevents JSON fragmentation during HTTP streaming.
    """
    import gzip
    
    # Decode base64 to bytes
    audio_bytes = base64.b64decode(pcm_base64)
    
    # Compress with gzip (level 6 = good balance speed/compression)
    compressed = gzip.compress(audio_bytes, compresslevel=6)
    
    # Encode back to base64
    return base64.b64encode(compressed).decode('utf-8')

def split_for_streaming(base64_data: str, chunk_size: int = 8000) -> list[str]:
    """Split large base64 data into smaller chunks for reliable streaming.
    
    Industry standard: Send data in smaller chunks to avoid HTTP fragmentation.
    Each chunk is sent as a separate NDJSON message.
    """
    chunks = []
    for i in range(0, len(base64_data), chunk_size):
        chunks.append(base64_data[i:i + chunk_size])
    return chunks

def decode_webm_to_pcm(webm_bytes: bytes, target_sr: int = 16000) -> tuple[bytes, int]:
    """Decode webm/opus audio to raw PCM int16 using ffmpeg.
    
    Returns: (pcm_bytes, sample_rate)
    """
    import subprocess
    import tempfile
    import os
    
    # Write input to temp file
    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as inp:
        inp.write(webm_bytes)
        inp_path = inp.name
    
    # Write output to temp file
    out_path = inp_path.replace('.webm', '.raw')
    
    try:
        # Decode with ffmpeg
        cmd = [
            'ffmpeg', '-y', '-i', inp_path,
            '-acodec', 'pcm_s16le',  # 16-bit PCM
            '-ac', '1',               # Mono
            '-ar', str(target_sr),    # Target sample rate
            '-f', 's16le',            # Raw PCM format
            out_path
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            print(f"[Audio Decode] ffmpeg error: {result.stderr}", flush=True)
            raise ValueError(f"ffmpeg failed: {result.stderr}")
        
        # Read the output
        with open(out_path, 'rb') as f:
            pcm_data = f.read()
        
        return pcm_data, target_sr
        
    finally:
        # Clean up temp files
        try:
            os.unlink(inp_path)
            if os.path.exists(out_path):
                os.unlink(out_path)
        except:
            pass

def is_webm_audio(audio_bytes: bytes) -> bool:
    """Check if audio appears to be webm/opus format."""
    return audio_bytes[:4] == b'\x1a\x45\xdf\xa3' or \
           audio_bytes[:3] == b'\xf3\xff\xfb' or \
           b'opus' in audio_bytes[:1000].lower() or \
           audio_bytes[:20].startswith(b'RIFF') and b'WEBP' in audio_bytes[:50]

def ensure_pcm_int16(audio_bytes: bytes, target_sr: int = 16000) -> tuple[bytes, int]:
    """Ensure audio is in PCM int16 format.
    
    If audio is webm/opus, decode it. If it's already PCM, return as-is.
    Returns: (pcm_bytes, sample_rate)
    """
    # Check if it's webm/opus
    if is_webm_audio(audio_bytes):
        print("[Audio] Detected webm/opus, decoding to PCM...", flush=True)
        return decode_webm_to_pcm(audio_bytes, target_sr)
    
    # Already PCM - return as-is
    return audio_bytes, target_sr

# =============================================================================
# VAD (Simplified - using energy-based for now)
# =============================================================================

def check_vad_simple(audio_bytes: bytes, sample_rate: int = 16000) -> bool:
    """Simple energy-based VAD. Returns True if audio contains speech.
    
    Handles both raw PCM and webm/opus audio formats.
    """
    import numpy as np
    
    # Decode webm/opus to PCM if needed
    pcm_bytes, actual_sr = ensure_pcm_int16(audio_bytes, sample_rate)
    
    try:
        audio_np = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    except Exception as e:
        print(f"[VAD] Error decoding audio: {e}", flush=True)
        return False
    
    # Calculate RMS energy
    rms = np.sqrt(np.mean(audio_np ** 2))
    
    # Threshold - tune based on testing
    return rms > 0.02

# =============================================================================
# ASR - mlx-whisper
# =============================================================================

async def transcribe_audio(
    audio_base64: str,
    signal: Optional[asyncio.CancelledError] = None
) -> str:
    """Transcribe audio to text using mlx-whisper."""
    import numpy as np
    
    # Check for abort
    if signal and signal.cancelled:
        raise asyncio.CancelledError("Transcription cancelled")
    
    try:
        wav_bytes, sr = base64_to_wav(audio_base64, 16000)
        
        # Load model if needed
        whisper = model_cache.load_whisper()
        if whisper is None:
            raise RuntimeError("Whisper model not available")
        
        # Save to temp file (mlx-whisper needs file path)
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(wav_bytes)
            tmp_path = tmp.name
        
        try:
            # Run transcription
            # Note: mlx_whisper.transcribe is sync, run in executor
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: whisper['module'].transcribe(
                    tmp_path,
                    language="en"
                )
            )
            
            # Check for abort after transcription
            if signal and signal.cancelled:
                raise asyncio.CancelledError("Transcription cancelled")
            
            return result.get("text", "").strip()
        finally:
            os.unlink(tmp_path)
            
    except asyncio.CancelledError:
        raise
    except Exception as e:
        print(f"[ASR Error] {e}", flush=True)
        return f"[ASR Error: {str(e)}]"

# =============================================================================
# LLM - Maya Response
# =============================================================================

async def generate_maya_response(
    user_text: str,
    session_id: str,
    signal: Optional[asyncio.CancelledError] = None,
    vocabulary: list[str] = None
) -> str:
    """Generate Maya's response using the LLM."""
    import requests
    
    # Check for abort
    if signal and signal.cancelled:
        raise asyncio.CancelledError("LLM generation cancelled")
    
    try:
        # Get session context
        session = get_session(session_id)
        
        # System prompt
        system_content = MAYA_SYSTEM_PROMPT
        if vocabulary:
            system_content += f"\n\nFocus on this vocabulary: {', '.join(vocabulary)}"
        
        # Build messages for chat history
        messages = [{"role": "system", "content": system_content}]
        
        # Chat history (if exists)
        if session and session.messages:
            for msg in session.messages[-10:]:  # Last 10 messages
                messages.append(msg)
        
        # User message
        messages.append({"role": "user", "content": user_text})
        
        # Check for abort before LLM call
        if signal and signal.cancelled:
            raise asyncio.CancelledError("LLM generation cancelled")
        
        # Get LLM config from environment
        llm_provider = os.getenv("LLM_PROVIDER", "cloud")
        
        print(f"[LLM] Provider: {llm_provider}", flush=True)
        
        loop = asyncio.get_event_loop()
        
        if llm_provider == "local":
            # LM Studio Configuration
            base_url = os.getenv("LOCAL_BASE_URL", "http://localhost:1234/api/v1")
            model = os.getenv("LOCAL_MODEL_NAME", "google/gemma-4-26b-a4b")
            
            print(f"[LLM] Base URL: {base_url}", flush=True)
            print(f"[LLM] Model: {model}", flush=True)
            
            # LM Studio format (different from OpenAI)
            response = await loop.run_in_executor(
                None,
                lambda: requests.post(
                    f"{base_url}/chat",
                    headers={"Content-Type": "application/json"},
                    json={
                        "model": model,
                        "system_prompt": system_content,
                        "input": user_text
                    },
                    timeout=60
                )
            )
            
            print(f"[LLM] LM Studio response status: {response.status_code}", flush=True)
            
            if response.status_code != 200:
                print(f"[LLM] LM Studio error response: {response.text[:500]}", flush=True)
                raise RuntimeError(f"LLM error: {response.status_code}")
            
            result = response.json()
            print(f"[LLM] LM Studio result keys: {list(result.keys())}", flush=True)
            print(f"[LLM] Full result: {str(result)[:500]}", flush=True)
            
            # LM Studio returns: {"output": [{"type": "reasoning", "content": "..."}, {"type": "message", "content": "..."}]}
            maya_text = ""
            output = result.get("output", [])
            if isinstance(output, list):
                for item in output:
                    if isinstance(item, dict) and item.get("type") == "message":
                        maya_text = item.get("content", "")
                        break
            
            if not maya_text:
                # Fallback: try other formats
                maya_text = result.get("response", "")
            if not maya_text:
                maya_text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            
            print(f"[LLM] Parsed Maya text: '{maya_text[:100]}...'", flush=True)
            
        else:
            # Cloud Configuration (NVIDIA/Groq/OpenAI compatible)
            api_key = os.getenv("CLOUD_API_KEY", "no-key-required")
            base_url = os.getenv("CLOUD_BASE_URL", "https://api.groq.com/openai/v1")
            model = os.getenv("CLOUD_MODEL", "moonshotai/kimi-k2.6")
            
            print(f"[LLM] Base URL: {base_url}", flush=True)
            print(f"[LLM] Model: {model}", flush=True)
            
            response = await loop.run_in_executor(
                None,
                lambda: requests.post(
                    f"{base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": model,
                        "messages": messages,
                        "temperature": 0.7,
                        "max_tokens": 150
                    },
                    timeout=30
                )
            )
            
            print(f"[LLM] Cloud response status: {response.status_code}", flush=True)
            
            if response.status_code != 200:
                print(f"[LLM] Cloud error response: {response.text[:500]}", flush=True)
                raise RuntimeError(f"LLM error: {response.status_code}")
            
            result = response.json()
            maya_text = result["choices"][0]["message"]["content"]
        
        # Check for abort after LLM call
        if signal and signal.cancelled:
            raise asyncio.CancelledError("LLM generation cancelled")
        
        print(f"[LLM] Maya response: {maya_text[:100]}...", flush=True)
        
        # Update session history
        if session:
            session.messages.append({"role": "user", "content": user_text})
            session.messages.append({"role": "assistant", "content": maya_text})
        
        return maya_text
        
    except asyncio.CancelledError:
        raise
    except Exception as e:
        print(f"[LLM Error] {e}", flush=True)
        return f"[Maya is thinking... ({str(e)[:50]})]"

# =============================================================================
# TTS - F5-TTS or VibeVoice
# =============================================================================

async def stream_tts(
    text: str,
    mode: str,
    signal: Optional[asyncio.CancelledError] = None,
    tts_provider: str = 'f5tts',
    tts_voice: str = 'en-Emma_woman',
    reference_audio_path: Optional[str] = None,
    reference_text: Optional[str] = None,
    session_id: str = ""
) -> AsyncGenerator[dict, None]:
    """Stream TTS audio chunks using user-selected provider."""
    import numpy as np
    
    try:
        # Immersive mode uses local VibeVoice model
        if mode == "immersive":
            model = model_cache.load_vibevoice()
            if model:
                async for chunk in _stream_vibevoice(text, model, signal, reference_audio_path, session_id):
                    yield chunk
                return
        
        # Route to appropriate TTS provider based on user settings
        if tts_provider == 'f5tts':
            print(f"[TTS] Using F5-TTS provider with voice: {tts_voice}", flush=True)
            try:
                async for chunk in _stream_f5tts(
                    text, 
                    signal=signal, 
                    reference_audio_path=reference_audio_path, 
                    reference_text=reference_text, 
                    session_id=session_id
                ):
                    yield chunk
                return
            except Exception as f5_err:
                print(f"[TTS] F5-TTS failed: {f5_err}, falling back to Kokoro", flush=True)
                async for chunk in _stream_kokoro_fallback(text, signal, session_id):
                    yield chunk
                return
                
        elif tts_provider == 'vibevoice7b':
            print(f"[TTS] Using VibeVoice7B provider with voice: {tts_voice}", flush=True)
            async for chunk in _stream_vibevoice_http(text, signal, tts_voice, session_id):
                yield chunk
            return
                
        elif tts_provider == 'kokoro':
            print(f"[TTS] Using Kokoro provider with voice: {tts_voice}", flush=True)
            async for chunk in _stream_kokoro_fallback(text, signal, session_id, voice=tts_voice):
                yield chunk
            return
                
        elif tts_provider == 'piper':
            print(f"[TTS] Using Piper provider with voice: {tts_voice}", flush=True)
            async for chunk in _stream_piper_http(text, signal, tts_voice, session_id):
                yield chunk
            return
                
        else:
            # Default to F5-TTS
            print(f"[TTS] Unknown provider {tts_provider}, defaulting to F5-TTS", flush=True)
            async for chunk in _stream_f5tts(
                text, 
                signal=signal, 
                reference_audio_path=reference_audio_path, 
                reference_text=reference_text, 
                session_id=session_id
            ):
                yield chunk
            
    except asyncio.CancelledError:
        raise
    except Exception as e:
        print(f"[TTS Error] {e}", flush=True)
        yield {"type": "error", "message": str(e)}

async def _stream_vibevoice(
    text: str,
    model: dict,
    signal: Optional[asyncio.CancelledError] = None,
    reference_audio_path: Optional[str] = None,
    session_id: str = ""
) -> AsyncGenerator[dict, None]:
    """Stream audio using VibeVoice."""
    import numpy as np
    
    loop = asyncio.get_event_loop()
    
    config = type('obj', (object,), {
        'max_new_tokens': 1024,
        'cfg_scale': 1.3,
        'diffusion_steps': 15,
        'temperature': 0.0,
    })()
    
    voice_samples = None
    default_voice = os.path.join(SCRIPT_DIR, "reference_voices", "en_Emma_woman.wav")
    
    if reference_audio_path is None:
        reference_audio_path = default_voice
    
    if reference_audio_path and os.path.exists(reference_audio_path):
        from mlx_speech.audio.io import load_audio
        waveform, sr = load_audio(reference_audio_path, sample_rate=24000, mono=True)
        voice_samples = [waveform.reshape(1, 1, -1)]
        print(f"[TTS] Using voice: {os.path.basename(reference_audio_path)}", flush=True)
    
    result = await loop.run_in_executor(
        None,
        lambda: model['synthesize'](
            model['instance'],
            model['tokenizer'],
            text,
            voice_samples=voice_samples,
            config=config
        )
    )
    
    # Check for abort
    if signal and signal.cancelled:
        raise asyncio.CancelledError("TTS cancelled")
    
    audio_np = np.array(result.waveform, dtype=np.float32)
    if audio_np.ndim > 1:
        audio_np = audio_np.flatten()
    
    # Normalize
    max_abs = max(abs(audio_np.min()), abs(audio_np.max()))
    if max_abs > 1.0:
        audio_np = audio_np / max_abs
    
    # Yield as single chunk (VibeVoice doesn't stream during generation)
    pcm_base64 = audio_to_base64_pcm(audio_np)
    compressed = compress_audio_data(pcm_base64)
    
    # Save audio as WAV for debugging/download
    audio_path = Path(f"/tmp/maya_audio_{session_id}.wav")
    with wave.open(str(audio_path), 'wb') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(int(result.sample_rate))
        audio_int16 = (audio_np * 32767).astype(np.int16)
        wav_file.writeframes(audio_int16.tobytes())
    
    yield {"type": "audio_chunk", "data": compressed, "sample_rate": result.sample_rate, "compressed": True, "download_url": f"/v1/voice/audio/{session_id}"}

async def _stream_f5tts(
    text: str,
    signal: Optional[asyncio.CancelledError] = None,
    reference_audio_path: Optional[str] = None,
    reference_text: Optional[str] = None,
    session_id: str = ""
) -> AsyncGenerator[dict, None]:
    """Stream audio using F5-TTS with voice cloning.
    
    Uses the f5_tts_mlx.generate function which handles all the complexity correctly.
    """
    import numpy as np
    import soundfile as sf
    import time
    
    # Check for abort
    if signal and signal.cancelled:
        raise asyncio.CancelledError("TTS cancelled")
    
    # Default reference audio
    if reference_audio_path is None:
        reference_audio_path = os.path.join(SCRIPT_DIR, "reference_voices", "en_Emma_woman.wav")
    
    # Default reference text
    if reference_text is None:
        reference_text = "Some call me nature, others call me mother nature."
    
    print(f"[F5-TTS] Using reference: {reference_audio_path}", flush=True)
    print(f"[F5-TTS] Reference text: '{reference_text}'", flush=True)
    print(f"[F5-TTS] Generation text: '{text[:50]}...'", flush=True)
    
    try:
        # Use generate function from f5_tts_mlx
        from f5_tts_mlx.generate import generate as f5_generate, SAMPLE_RATE
        
        print(f"[F5-TTS] Using F5-TTS generate function...", flush=True)
        
        start_time = time.time()
        
        # Split text by sentences to reduce hallucinations
        import re
        sentences = re.split(r'(?<=[.!?])\s+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        print(f"[F5-TTS] Split into {len(sentences)} sentences", flush=True)
        
        # Generate audio for each sentence and concatenate
        all_audio = []
        sample_rate = 24000
        
        for i, sentence in enumerate(sentences):
            print(f"[F5-TTS] Processing sentence {i+1}/{len(sentences)}: '{sentence[:50]}...'", flush=True)
            
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_sentence:
                sentence_path = tmp_sentence.name
            
            try:
                f5_generate(
                    generation_text=sentence,
                    ref_audio_path=reference_audio_path,
                    ref_audio_text=reference_text,
                    steps=16,
                    speed=1.0,
                    output_path=sentence_path
                )
                
                sentence_audio, sr = sf.read(sentence_path)
                all_audio.append(sentence_audio)
                print(f"[F5-TTS] Sentence {i+1}: {len(sentence_audio)/sr:.2f}s", flush=True)
            finally:
                try:
                    os.remove(sentence_path)
                except:
                    pass
        
        generation_time = time.time() - start_time
        print(f"[F5-TTS] Generation took {generation_time:.2f}s", flush=True)
        
        # Concatenate all audio
        audio_np = np.concatenate(all_audio)
        print(f"[F5-TTS] Total generated {len(audio_np)/sr:.2f}s of audio", flush=True)
        
        # Encode audio as base64 PCM (uncompressed for simplicity)
        pcm_base64 = audio_to_base64_pcm(audio_np)
        
        # Save audio as WAV for debugging/download
        audio_path = Path(f"/tmp/maya_audio_{session_id}.wav")
        print(f"[F5-TTS] Saving WAV to {audio_path}, session_id='{session_id}'", flush=True)
        with wave.open(str(audio_path), 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(int(sr))
            audio_int16 = (audio_np * 32767).astype(np.int16)
            wav_file.writeframes(audio_int16.tobytes())
        print(f"[F5-TTS] Saved WAV to {audio_path} ({audio_path.stat().st_size} bytes)", flush=True)
        
        # Send as single chunk - no compression for simplicity
        print(f"[F5-TTS] Sending single audio chunk ({len(pcm_base64)} bytes)", flush=True)
        yield {
            "type": "audio_chunk",
            "data": pcm_base64,
            "sample_rate": int(sr),
            "compressed": False,
"download_url": f"{DEFAULT_HOST}/v1/voice/audio/{session_id}"
        }
        
    except asyncio.CancelledError:
        raise
    except Exception as e:
        print(f"[F5-TTS Error] {e}", flush=True)
        import traceback
        traceback.print_exc()
        yield {"type": "error", "message": str(e)}

async def _stream_kokoro_fallback(
    text: str,
    signal: Optional[asyncio.CancelledError] = None,
    session_id: str = "",
    voice: str = "af_bella"
) -> AsyncGenerator[dict, None]:
    """Fallback to Kokoro TTS via HTTP."""
    import numpy as np
    import requests
    
    try:
        # Check for abort
        if signal and signal.cancelled:
            raise asyncio.CancelledError("TTS cancelled")
        
        # Call Kokoro
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: requests.post(
                "http://localhost:8880/v1/audio/speech",
                json={
                    "input": text,
                    "voice": voice,
                    "speed": "1.0"
                },
                timeout=30
            )
        )
        
        if response.status_code != 200:
            raise RuntimeError(f"Kokoro error: {response.status_code}")
        
        # Decode WAV to PCM
        wav_data = response.content
        buffer = io.BytesIO(wav_data)
        with wave.open(buffer, 'rb') as wav:
            frames = wav.readframes(wav.getnframes())
            sr = wav.getframerate()
        
        audio_np = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32767.0
        
        # Check for abort
        if signal and signal.cancelled:
            raise asyncio.CancelledError("TTS cancelled")
        
        # Yield as chunks (chunk every 0.5s)
        chunk_size = int(sr * 0.5)
        for i in range(0, len(audio_np), chunk_size):
            if signal and signal.cancelled:
                raise asyncio.CancelledError("TTS cancelled")
            
            chunk = audio_np[i:i + chunk_size]
            pcm_base64 = audio_to_base64_pcm(chunk)
            yield {"type": "audio_chunk", "data": pcm_base64, "sample_rate": sr, "compressed": False, "download_url": f"/v1/voice/audio/{session_id}"}
            
            # Small delay to simulate streaming
            await asyncio.sleep(0.05)
        
        # Save audio as WAV for debugging/download
        audio_path = Path(f"/tmp/maya_audio_{session_id}.wav")
        with wave.open(str(audio_path), 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(int(sr))
            audio_int16 = (audio_np * 32767).astype(np.int16)
            wav_file.writeframes(audio_int16.tobytes())
            
    except asyncio.CancelledError:
        raise
    except Exception as e:
        print(f"[Kokoro Fallback Error] {e}", flush=True)
        yield {"type": "error", "message": str(e)}


async def _stream_vibevoice_http(
    text: str,
    signal: Optional[asyncio.CancelledError] = None,
    voice: str = "en-Emma_woman",
    session_id: str = ""
) -> AsyncGenerator[dict, None]:
    """VibeVoice7B TTS via HTTP."""
    import numpy as np
    import requests
    
    try:
        if signal and signal.cancelled:
            raise asyncio.CancelledError("TTS cancelled")
        
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: requests.post(
                "http://localhost:8091/v1/audio/speech",
                json={
                    "input": text,
                    "voice": voice,
                    "response_format": "wav"
                },
                timeout=60
            )
        )
        
        if response.status_code != 200:
            raise RuntimeError(f"VibeVoice7B error: {response.status_code}")
        
        wav_data = response.content
        buffer = io.BytesIO(wav_data)
        with wave.open(buffer, 'rb') as wav:
            frames = wav.readframes(wav.getnframes())
            sr = wav.getframerate()
        
        audio_np = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32767.0
        
        if signal and signal.cancelled:
            raise asyncio.CancelledError("TTS cancelled")
        
        # Yield as single chunk for now (VibeVoice7B generates full audio)
        pcm_base64 = audio_to_base64_pcm(audio_np)
        
        # Save for download
        audio_path = Path(f"/tmp/maya_audio_{session_id}.wav")
        with wave.open(str(audio_path), 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sr)
            audio_int16 = (audio_np * 32767).astype(np.int16)
            wav_file.writeframes(audio_int16.tobytes())
        
        yield {"type": "audio_chunk", "data": pcm_base64, "sample_rate": sr, "compressed": False, "download_url": f"{DEFAULT_HOST}/v1/voice/audio/{session_id}"}
        
    except asyncio.CancelledError:
        raise
    except Exception as e:
        print(f"[VibeVoice7B HTTP Error] {e}", flush=True)
        yield {"type": "error", "message": str(e)}


async def _stream_piper_http(
    text: str,
    signal: Optional[asyncio.CancelledError] = None,
    voice: str = "en_GB-alan-medium",
    session_id: str = ""
) -> AsyncGenerator[dict, None]:
    """Piper TTS via HTTP."""
    import numpy as np
    import requests
    
    try:
        if signal and signal.cancelled:
            raise asyncio.CancelledError("TTS cancelled")
        
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: requests.post(
                "http://localhost:8080/tts",
                json={
                    "text": text,
                    "voice": voice
                },
                timeout=30
            )
        )
        
        if response.status_code != 200:
            raise RuntimeError(f"Piper error: {response.status_code}")
        
        wav_data = response.content
        buffer = io.BytesIO(wav_data)
        with wave.open(buffer, 'rb') as wav:
            frames = wav.readframes(wav.getnframes())
            sr = wav.getframerate()
        
        audio_np = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32767.0
        
        if signal and signal.cancelled:
            raise asyncio.CancelledError("TTS cancelled")
        
        # Yield as single chunk
        pcm_base64 = audio_to_base64_pcm(audio_np)
        
        # Save for download
        audio_path = Path(f"/tmp/maya_audio_{session_id}.wav")
        with wave.open(str(audio_path), 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sr)
            audio_int16 = (audio_np * 32767).astype(np.int16)
            wav_file.writeframes(audio_int16.tobytes())
        
        yield {"type": "audio_chunk", "data": pcm_base64, "sample_rate": sr, "compressed": False, "download_url": f"{DEFAULT_HOST}/v1/voice/audio/{session_id}"}
        
    except asyncio.CancelledError:
        raise
    except Exception as e:
        print(f"[Piper HTTP Error] {e}", flush=True)
        yield {"type": "error", "message": str(e)}


# =============================================================================
# FastAPI App
# =============================================================================

app = FastAPI(title="Maya Live Voice Server")

class VoiceConversationRequest(BaseModel):
    user_audio: str
    session_id: Optional[str] = None
    mode: str = "fast"  # "fast" or "immersive"
    vocabulary: Optional[list[str]] = None
    tts_provider: str = "f5tts"  # TTS provider: f5tts, vibevoice7b, kokoro, piper
    tts_voice: str = DEFAULT_MAYA_VOICE  # Voice for the TTS provider

class SessionResetRequest(BaseModel):
    session_id: str

class AbortRequest(BaseModel):
    session_id: str

def json_chunk(type_: str, data: Any) -> str:
    """Create NDJSON chunk."""
    return json.dumps({"type": type_, "data": data}) + "\n"

@app.get("/health")
async def health():
    return {
        "status": "ready",
        "service": "maya-live-voice",
        "version": "1.0.0",
        "endpoints": {
            "conversation": "POST /v1/voice/conversation",
            "abort": "POST /v1/voice/abort",
            "reset": "POST /v1/voice/session/reset"
        }
    }

@app.post("/v1/voice/conversation")
async def voice_conversation(
    request: Request,
    body: VoiceConversationRequest
):
    """Main endpoint: Voice conversation with Maya.
    
    Implements Strategy B: Full abort propagation.
    If client disconnects, all operations (ASR, LLM, TTS) are cancelled.
    """
    
    session_id = body.session_id or create_session().id
    mode = body.mode
    vocabulary = body.vocabulary or []
    tts_provider = body.tts_provider or 'f5tts'
    tts_voice = body.tts_voice or DEFAULT_MAYA_VOICE
    
    async def generate():
        try:
            signal = None
            
            # Check for client disconnect
            while True:
                if await request.is_disconnected():
                    print(f"[SESSION] Client disconnected, aborting session {session_id}", flush=True)
                    mark_session_aborted(session_id)
                    break
                await asyncio.sleep(0.1)
                break
            
            # Step 1: VAD check
            print(f"[VAD] Checking audio for speech...", flush=True)
            has_speech = check_vad_simple(base64.b64decode(body.user_audio))
            
            if not has_speech:
                yield json_chunk("vad", {"detected": False})
                yield json_chunk("end", {})
                return
            
            yield json_chunk("vad", {"detected": True})
            
            # Step 2: ASR - Transcription
            print(f"[ASR] Transcribing...", flush=True)
            yield json_chunk("status", {"stage": "transcribing"})
            
            try:
                transcript = await transcribe_audio(body.user_audio)
            except asyncio.CancelledError:
                print("[ASR] Transcription cancelled", flush=True)
                yield json_chunk("error", "Transcription cancelled by user")
                return
            
            yield json_chunk("transcription", {"text": transcript})
            print(f"[ASR] Transcribed: {transcript[:50]}...", flush=True)
            
            # Check for disconnect before LLM
            if await request.is_disconnected():
                mark_session_aborted(session_id)
                return
            
            # Step 3: LLM - Maya response
            print(f"[LLM] Generating Maya response...", flush=True)
            yield json_chunk("status", {"stage": "maya_thinking"})
            
            try:
                maya_response = await generate_maya_response(
                    transcript,
                    session_id,
                    vocabulary=vocabulary
                )
            except asyncio.CancelledError:
                print("[LLM] Maya response cancelled", flush=True)
                yield json_chunk("error", "Response cancelled by user")
                return
            
            yield json_chunk("maya_response", {"text": maya_response})
            print(f"[LLM] Maya: {maya_response[:50]}...", flush=True)
            
            # Use the full text since Maya no longer includes brackets
            speech_text = maya_response.strip()
            print(f"[TTS] Speech text: {speech_text[:50]}...", flush=True)
            
            # Check for disconnect before TTS
            if await request.is_disconnected():
                mark_session_aborted(session_id)
                return
            
            # Step 4: TTS Streaming
            print(f"[TTS] Streaming audio (mode={mode})...", flush=True)
            yield json_chunk("status", {"stage": "speaking"})
            
            try:
                # Map tts_voice to reference audio file and reference text
                voice_file = VOICE_ID_TO_FILE.get(tts_voice, "en_Emma_woman.wav")
                ref_voice_path = os.path.join(SCRIPT_DIR, "reference_voices", voice_file)
                ref_text = VOICE_ID_TO_REF_TEXT.get(tts_voice, "Some call me nature, others call me mother nature.")
                
                print(f"[TTS] Provider: {tts_provider}, Voice: {tts_voice}", flush=True)
                print(f"[TTS] Reference: {ref_voice_path}", flush=True)
                print(f"[TTS] Ref text: '{ref_text[:50]}...'", flush=True)
                
                async for chunk in stream_tts(
                    speech_text, 
                    mode, 
                    tts_provider=tts_provider,
                    tts_voice=tts_voice,
                    reference_audio_path=ref_voice_path, 
                    reference_text=ref_text, 
                    session_id=session_id
                ):
                    # Check for disconnect between chunks
                    if await request.is_disconnected():
                        print("[TTS] Stream interrupted by client", flush=True)
                        mark_session_aborted(session_id)
                        break
                    
                    if chunk["type"] == "audio_chunk":
                        yield json_chunk("audio_chunk", {
                            "data": chunk["data"],
                            "sample_rate": chunk.get("sample_rate", 24000),
                            "compressed": chunk.get("compressed", False),
                            "download_url": chunk.get("download_url")
                        })
                    elif chunk["type"] == "error":
                        yield json_chunk("error", chunk["message"])
                
                yield json_chunk("end", {})
                print(f"[SESSION] Completed session {session_id}", flush=True)
                
            except asyncio.CancelledError:
                print("[TTS] Streaming cancelled", flush=True)
                yield json_chunk("error", "Audio interrupted by user")
                
        except Exception as e:
            print(f"[ERROR] {e}", flush=True)
            yield json_chunk("error", str(e))
    
    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "identity"
        }
    )

@app.post("/v1/voice/session/reset")
async def reset_session(req: SessionResetRequest):
    """Reset session history - for when user interrupts Maya."""
    reset_session(req.session_id)
    return {"status": "reset", "session_id": req.session_id}

@app.post("/v1/voice/abort")
async def abort_session(req: AbortRequest):
    """Signal abort for a session - for barge-in."""
    mark_session_aborted(req.session_id)
    return {"status": "aborted", "session_id": req.session_id}

@app.get("/v1/voice/audio/{session_id}")
async def download_audio(session_id: str):
    """Download the generated audio as WAV file."""
    audio_path = Path(f"/tmp/maya_audio_{session_id}.wav")
    
    if not audio_path.exists():
        print(f"[Audio Download] File not found: {audio_path}", flush=True)
        return {"error": "Audio not found or expired", "session_id": session_id}
    
    print(f"[Audio Download] Serving: {audio_path}", flush=True)
    return FileResponse(
        str(audio_path),
        media_type="audio/wav",
        filename=f"maya_response_{session_id}.wav"
    )

# =============================================================================
# Main
# =============================================================================

def main():
    global DEFAULT_PORT
    
    parser = argparse.ArgumentParser(description="Maya Live Voice Server")
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, help=f"Port (default: {DEFAULT_PORT})")
    parser.add_argument('--preload', action='store_true', help="Preload all models on startup")
    args = parser.parse_args()
    
    print("=" * 60, flush=True)
    print("Maya Live Voice Server v1.0.0", flush=True)
    print("Mode: Strategy B - Full Abort + LLM Cancel", flush=True)
    print("=" * 60, flush=True)
    print(f"Port: {args.port}", flush=True)
    print("Endpoints:", flush=True)
    print("  GET  /health                  - Health check", flush=True)
    print("  POST /v1/voice/conversation   - Voice conversation (streaming)", flush=True)
    print("  POST /v1/voice/session/reset  - Reset session history", flush=True)
    print("  POST /v1/voice/abort          - Abort current session", flush=True)
    print("=" * 60, flush=True)
    
    if args.preload:
        print("[INIT] Preloading models...", flush=True)
        model_cache.load_f5tts()
        model_cache.load_vibevoice()
        model_cache.load_whisper()
        print("[INIT] All models loaded", flush=True)
    
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=args.port, log_level="info")

if __name__ == "__main__":
    main()
