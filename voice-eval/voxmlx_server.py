#!/usr/bin/env python3
"""
VoxMLX HTTP Server for pronunciation evaluation.

Transcribes audio via HTTP POST and returns transcription text.
Uses Voxtral Mini via voXMLX for local speech-to-text.
"""
import tempfile
from pathlib import Path

import soundfile as sf
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
import uvicorn
from voxmlx import transcribe as voxtral_transcribe

app = FastAPI(title="VoxMLX Server")

MODEL_PATH = Path(__file__).parent / "models" / "Voxtral-2602- mlx"

ALLOWED_LANGUAGES = {"en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko"}


@app.get("/health")
async def health_check() -> dict:
    """Check if server and model are available."""
    model_ready = MODEL_PATH.exists()
    return {
        "status": "healthy" if model_ready else "degraded",
        "model_loaded": model_ready,
        "model_path": str(MODEL_PATH),
    }


@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form(default="en"),
) -> JSONResponse:
    """
    Transcribe audio file to text.

    Args:
        file: Audio file (wav, mp3, flac, etc.)
        language: ISO 639-1 language code (default: en)

    Returns:
        JSON with transcription text
    """
    if language not in ALLOWED_LANGUAGES:
        language = "en"

    try:
        audio_bytes = await file.read()

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            temp_path = Path(f.name)

        try:
            audio, sr = sf.read(temp_path, dtype="float32")
            sf.write(temp_path, audio, sr)

            result = voxtral_transcribe(
                str(temp_path),
                model_ path=str(MODEL_PATH)
            )

            return JSONResponse({
                "text": result.strip(),
                "language": language,
                "model": "Voxtral-Mini-4B",
            })

        finally:
            temp_path.unlink(missing_ok=True)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="VoxMLX HTTP Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind")
    parser.add_argument("--port", type=int, default=10300, help="Port to bind")
    parser.add_argument("--model", default=None, help="Override model path")
    args = parser.parse_args()

    if args.model:
        MODEL_PATH = Path(args.model)

    print(f"Starting VoxMLX Server on {args.host}:{args.port}")
    print(f"Using model: {MODEL_PATH}")

    uvicorn.run(app, host=args.host, port=args.port)