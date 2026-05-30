"""
Genki 2.0 — Kokoro TTS Server
Serves text-to-speech via HTTP. Uses kokoro-onnx for CPU inference.
Voices are loaded from ./voices/ directory (mounted at build or runtime).
"""
import io
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import soundfile as sf
import numpy as np

pipeline = None
VOICES_DIR = os.getenv("KOKORO_VOICES_DIR", "/app/voices")
DEFAULT_VOICE = os.getenv("KOKORO_DEFAULT_VOICE", "af_sarah")
AVAILABLE_VOICES = []


def load_kokoro():
    global pipeline, AVAILABLE_VOICES
    if pipeline is not None:
        return
    print("[Kokoro] Initializing TTS pipeline...")
    from kokoro import KPipeline
    pipeline = KPipeline(lang="en", voices_dir=VOICES_DIR)
    try:
        AVAILABLE_VOICES = sorted([
            f.replace(".onnx", "")
            for f in os.listdir(VOICES_DIR)
            if f.endswith(".onnx")
        ])
    except FileNotFoundError:
        AVAILABLE_VOICES = ["af_sarah", "af_nicole"]
    print(f"[Kokoro] Loaded. Voices: {AVAILABLE_VOICES}")


app = FastAPI(title="Genki Kokoro TTS Server", version="1.0.0")


@app.on_event("startup")
async def startup():
    load_kokoro()


class SynthesizeRequest(BaseModel):
    text: str
    voice: str = DEFAULT_VOICE
    speed: float = 1.0


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "kokoro",
        "pipeline_loaded": pipeline is not None,
        "available_voices": AVAILABLE_VOICES,
    }


@app.post("/synthesize")
async def synthesize(req: SynthesizeRequest) -> StreamingResponse:
    if pipeline is None:
        raise HTTPException(status_code=503, detail="TTS pipeline not loaded")

    try:
        generator = pipeline(req.text, voice=req.voice, speed=req.speed)
        audio_chunks = [w for w, _ in generator]
        if not audio_chunks:
            raise HTTPException(status_code=400, detail="No audio generated")

        audio = np.concatenate(audio_chunks)
        buffer = io.BytesIO()
        sr = getattr(generator, "samplerate", 24000)
        sf.write(buffer, audio, sr, format="WAV")
        buffer.seek(0)

        return StreamingResponse(
            iter([buffer.read()]),
            media_type="audio/wav",
            headers={
                "X-Voice": req.voice,
                "X-Speed": str(req.speed),
            },
        )

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Voice '{req.voice}' not found. Available: {AVAILABLE_VOICES}",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
