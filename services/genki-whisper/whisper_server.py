"""
Genki 2.0 — Whisper ASR Server (faster-whisper)
Serves transcription via HTTP. Model is downloaded on first run.
"""
import io
import os
import base64
import tempfile
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# faster-whisper is imported lazily to allow the server to start without model
model = None
MODEL_LOADED = False


def load_model():
    global model, MODEL_LOADED
    if MODEL_LOADED:
        return
    print("[Whisper] Loading model (this may take a few minutes on first run)...")
    from faster_whisper import WhisperModel
    # Use base model — tiny for speed, upgrade to small/medium for accuracy
    model = WhisperModel(
        "base",
        device="cpu",  # CPU only in Docker; use "cuda" if GPU available
        compute_type="int8",  # Fast quantization
    )
    MODEL_LOADED = True
    print("[Whisper] Model loaded.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


app = FastAPI(title="Genki Whisper ASR Server", version="1.0.0", lifespan=lifespan)


class TranscribeRequest(BaseModel):
    audio: str  # base64-encoded audio bytes
    language: str = "en"
    sample_rate: int = 16000


class TranscriptResponse(BaseModel):
    text: str
    language: str
    segments: int


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "whisper",
        "model_loaded": MODEL_LOADED,
    }


@app.post("/transcribe", response_model=TranscriptResponse)
async def transcribe(req: TranscribeRequest) -> TranscriptResponse:
    """Transcribe base64 audio to text."""
    if not MODEL_LOADED or model is None:
        raise HTTPException(status_code=503, detail="Model not yet loaded")

    try:
        # Decode base64 → raw bytes
        audio_bytes = base64.b64decode(req.audio)

        # Write to temp WAV (faster-whisper needs a file path)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            # Run transcription
            segments, info = model.transcribe(
                tmp_path,
                language=req.language,
                beam_size=5,
                vad_filter=True,
            )

            full_text = " ".join(seg.text.strip() for seg in segments)
            num_segments = len(list(segments))

            return TranscriptResponse(
                text=full_text.strip(),
                language=info.language or req.language,
                segments=num_segments,
            )
        finally:
            os.unlink(tmp_path)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
