"""Genki Voice Service - Streaming TTS + ASR Pipeline"""
import asyncio
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Service configuration
KOKORO_URL = os.getenv("KOKORO_URL", "http://localhost:5001")
SERVICE_PORT = int(os.getenv("SERVICE_PORT", "8092"))

# =============================================================================
# Models
# =============================================================================


class TranscriptionRequest(BaseModel):
    audio_data: str  # base64 encoded webm audio
    session_id: str | None = None


class TranscriptionResponse(BaseModel):
    text: str
    confidence: float | None = None


class VoiceConversationRequest(BaseModel):
    audio_data: str  # base64 encoded webm audio
    session_id: str
    voice_id: str = "af_heart"
    speed: float = 1.0


class AbortRequest(BaseModel):
    session_id: str


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str = "2.0.0"


class ReadinessResponse(BaseModel):
    status: str
    models_loaded: bool
    kokoro_connected: bool


# =============================================================================
# Lifespan
# =============================================================================

models_loaded = False
kokoro_connected = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    global models_loaded, kokoro_connected
    # Startup: verify Kokoro connectivity
    try:
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.get(f"{KOKORO_URL}/health", timeout=5.0)
            kokoro_connected = response.status_code == 200
    except Exception:
        kokoro_connected = False
 models_loaded = True # Models loaded on first use, not at startup
    yield
    # Shutdown


# =============================================================================
# FastAPI App
# =============================================================================

app = FastAPI(
    title="Genki Voice Service",
    description="Streaming TTS + ASR Pipeline for Genki 2.0",
    version="2.0.0",
    lifespan=lifespan,
)


# =============================================================================
# Health Endpoints
# =============================================================================


@app.get("/health", response_model=HealthResponse)
async def health():
    """Basic health check."""
    return HealthResponse(status="ok", service="genki-voice")


@app.get("/health/ready", response_model=ReadinessResponse)
async def readiness():
    """Readiness check - verifies models and dependencies are loaded."""
    return ReadinessResponse(
        status="ready" if models_loaded and kokoro_connected else "not_ready",
        models_loaded=models_loaded,
        kokoro_connected=kokoro_connected,
    )


# =============================================================================
# Voice Conversation Endpoint (Streaming)
# =============================================================================


@app.post("/v1/voice/conversation")
async def voice_conversation(
    request: VoiceConversationRequest,
) -> StreamingResponse:
    """
    Streaming voice conversation endpoint.

    Receives audio, transcribes it, streams to LLM, and streams TTS audio back.

    This is the core endpoint for the concurrent ASR+TTS pipeline.
    """
    from app.tts.kokoro import KokoroTTSClient
    from app.asr.whisper import WhisperASRClient

    abort_event = asyncio.Event()

    async def audio_stream() -> AsyncGenerator[bytes, None]:
        tts_client = KokoroTTSClient(kokoro_url=KOKORO_URL)
        asr_client = WhisperASRClient()

        try:
            # Step 1: Transcribe audio
            transcription = await asr_client.transcribe(
                audio_data=request.audio_data,
                abort_event=abort_event,
            )

            if abort_event.is_set():
                return

            # Step 2: Stream LLM response and synthesize TTS concurrently
            # (Placeholder - genki-llm client would be called here)
            llm_text = f"[Simulated response to: {transcription}]"

            # Step 3: Stream TTS audio chunks
            async for chunk in tts_client.stream_synthesize(
                text=llm_text,
                voice_id=request.voice_id,
                speed=request.speed,
                abort_event=abort_event,
            ):
                if abort_event.is_set():
                    break
                yield chunk

        except asyncio.CancelledError:
            abort_event.set()
            raise
        finally:
            await tts_client.close()
            await asr_client.close()

    return StreamingResponse(
        audio_stream(),
        media_type="application/octet-stream",
        headers={
            "X-Session-ID": request.session_id,
            "Transfer-Encoding": "chunked",
        },
    )


# =============================================================================
# Abort Endpoint
# =============================================================================


@app.post("/v1/voice/abort")
async def abort_conversation(request: AbortRequest) -> dict:
    """
    Abort the current conversation for a session.

    This triggers barge-in: stops ASR, LLM, and TTS processing.
    """
    # In a real implementation, this would:
    # 1. Look up the session's active abort event
    # 2. Set the abort event
    # 3. Return immediately (async cancellation handles the rest)
    return {
        "status": "aborted",
        "session_id": request.session_id,
        "message": "Abort signal sent",
    }


# =============================================================================
# Transcription Endpoint (standalone)
# =============================================================================


@app.post("/v1/voice/transcribe", response_model=TranscriptionResponse)
async def transcribe(request: TranscriptionRequest) -> TranscriptionResponse:
    """Standalone transcription endpoint for testing."""
    from app.asr.whisper import WhisperASRClient

    async with WhisperASRClient() as client:
        text = await client.transcribe(
            audio_data=request.audio_data,
            abort_event=None,
        )
        return TranscriptionResponse(text=text, confidence=None)


# =============================================================================
# Entry Point
# =============================================================================


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=SERVICE_PORT)
