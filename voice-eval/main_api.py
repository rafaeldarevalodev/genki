#!/usr/bin/env python3
"""
Voice Evaluation API

FastAPI server for pronunciation evaluation.
Uses difflib-based evaluator by default (no external ASR dependencies).

Usage:
    python main_api.py          # Run with defaults
    python main_api.py --port 10301  # Custom port
"""

import logging
import sys
import argparse
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from src.ai.types import EvaluationResult
from src.ai.evaluators.factory import (
    EvaluatorFactory,
    get_evaluator,
)
from src.ai.evaluators.base import (
    EvaluatorNotAvailableError,
    AudioProcessingError,
    EvaluationError,
)


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


# FastAPI app
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting Voice Evaluation API...")

    # Check available evaluators
    health = await EvaluatorFactory.health_check_all()
    logger.info(f"Available evaluators: {health}")

    yield

    # Shutdown
    logger.info("Shutting down Voice Evaluation API...")


app = FastAPI(
    title="Voice Evaluation API",
    description="Professional pronunciation evaluation service",
    version="1.0.0",
    lifespan=lifespan,
)


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Voice Evaluation API",
        "version": "1.0.0",
        "available_evaluators": EvaluatorFactory.available_evaluators(),
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    health_status = await EvaluatorFactory.health_check_all()
    return {
        "status": "healthy" if any(health_status.values()) else "degraded",
        "evaluators": health_status,
    }


@app.get("/evaluators")
async def list_evaluators():
    """List available evaluators."""
    return {
        "available": EvaluatorFactory.available_evaluators(),
        "default": "whisper (uses mlx-whisper, falls back to difflib)",
    }


@app.post("/evaluate")
async def evaluate(
    audio: UploadFile = File(..., description="Audio file to evaluate"),
    target_text: str = Form(..., description="Expected text"),
    evaluator: str = Form("whisper", description="Evaluator type (whisper/difflib)"),
    language: str = Form("en", description="Language code"),
) -> JSONResponse:
    """
    Evaluate pronunciation.

    Args:
        audio: Audio file (wav, mp3, etc.)
        target_text: Text the user should pronounce
        evaluator: Evaluator type ("difflib")
        language: ISO language code

    Returns:
        EvaluationResult with score, transcription, and feedback
    """
    logger.info(
        f"Evaluation request: target='{target_text}', "
        f"evaluator={evaluator}, language={language}"
    )

    # Validate evaluator type
    available = EvaluatorFactory.available_evaluators()
    if evaluator not in available:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid evaluator: {evaluator}. Available: {available}",
        )

    # Get evaluator
    evaluator_impl = get_evaluator(evaluator)

    # Check health
    if not await evaluator_impl.health_check():
        raise HTTPException(
            status_code=503,
            detail=f"Evaluator {evaluator} is not available. Check /health for status.",
        )

    # Read audio file
    try:
        audio_bytes = await audio.read()
    except Exception as e:
        logger.error(f"Failed to read audio: {e}")
        raise HTTPException(status_code=400, detail="Invalid audio file")

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Evaluate
    try:
        result = await evaluator_impl.evaluate(
            audio_data=audio_bytes, target_text=target_text, language=language
        )

        logger.info(
            f"Evaluation completed: score={result.score}, "
            f"time={result.processing_time_ms:.2f}ms"
        )

        return JSONResponse(content=result.model_dump())

    except EvaluatorNotAvailableError as e:
        logger.error(f"Evaluator not available: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except AudioProcessingError as e:
        logger.error(f"Audio processing error: {e}")
        raise HTTPException(status_code=400, detail=f"Audio processing error: {e}")
    except EvaluationError as e:
        logger.error(f"Evaluation error: {e}")
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {e}")
    except Exception as e:
        logger.exception("Unexpected error")
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger.exception(f"Unhandled exception: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


def main():
    """Run the server."""
    parser = argparse.ArgumentParser(description="Voice Evaluation API")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=10301, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")

    args = parser.parse_args()

    logger.info(f"Starting on {args.host}:{args.port}")
    logger.info(f"Default evaluator: difflib (builtin)")

    uvicorn.run(
        "main_api:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()
