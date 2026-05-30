"""Genki API Gateway - FastAPI Orchestration.

Orchestrates client requests to genki-voice, genki-llm, and genki-vector services.
Handles session management, Redis Pub/Sub events, and request routing.
"""
import asyncio
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.events.bus import EventBus
from app.session import SessionManager, SessionState


# =============================================================================
# Configuration
# =============================================================================

SERVICE_PORT = int(os.getenv("SERVICE_PORT", "8090"))
VOICE_SERVICE_URL = os.getenv("VOICE_SERVICE_URL", "http://genki-voice:8092")
LLM_SERVICE_URL = os.getenv("LLM_SERVICE_URL", "http://genki-llm:11434")
VECTOR_SERVICE_URL = os.getenv("VECTOR_SERVICE_URL", "http://genki-vector:6333")
REDIS_URL = os.getenv("REDIS_URL", "redis://genki-db:6379")


# =============================================================================
# Models
# =============================================================================


class SessionStartRequest(BaseModel):
    user_id: str | None = None
    voice_id: str = "af_heart"
    speed: float = 1.0


class SessionStartResponse(BaseModel):
    session_id: str
    status: str


class SessionStatusResponse(BaseModel):
    session_id: str
    state: str
    created_at: float


class InterruptRequest(BaseModel):
    session_id: str


class InterruptResponse(BaseModel):
    session_id: str
    status: str
    message: str


class VoiceConversationRequest(BaseModel):
    audio_data: str # base64 encoded webm audio
    session_id: str
    voice_id: str = "af_heart"
    speed: float = 1.0


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str = "2.0.0"


# =============================================================================
# Lifespan
# =============================================================================

event_bus: EventBus | None = None
session_manager: SessionManager | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global event_bus, session_manager
    # Startup: connect to Redis
    event_bus = EventBus(redis_url=REDIS_URL)
    session_manager = SessionManager(redis_url=REDIS_URL)
    await event_bus.connect()
    await session_manager.connect()
    yield
    # Shutdown
    await event_bus.close()
    await session_manager.close()


# =============================================================================
# FastAPI App
# =============================================================================

app = FastAPI(
    title="Genki API Gateway",
    description="Gateway orchestration for Genki 2.0 voice pipeline",
    version="2.0.0",
    lifespan=lifespan,
)


# =============================================================================
# Middleware
# =============================================================================


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add request_id to all requests for tracing."""
    request_id = request.headers.get("X-Request-ID", "")
    response = await call_next(request)
    if request_id:
        response.headers["X-Request-ID"] = request_id
    return response


# =============================================================================
# Health Endpoints
# =============================================================================


@app.get("/health", response_model=HealthResponse)
async def health():
    """Basic health check."""
    return HealthResponse(status="ok", service="genki-api")


@app.get("/health/ready")
async def readiness():
    """Readiness check - verifies Redis connectivity."""
    if not event_bus or not session_manager:
        return {"status": "not_ready"}
    return {"status": "ready"}


# =============================================================================
# Session Management Endpoints
# =============================================================================


@app.post("/session/start", response_model=SessionStartResponse)
async def start_session(request: SessionStartRequest) -> SessionStartResponse:
    """Start a new voice conversation session."""
    session = await session_manager.create(
        user_id=request.user_id,
        voice_id=request.voice_id,
        speed=request.speed,
    )
    return SessionStartResponse(
        session_id=session.session_id,
        status="started",
    )


@app.get("/session/{session_id}/status", response_model=SessionStatusResponse)
async def session_status(session_id: str) -> SessionStatusResponse:
    """Get the current status of a session."""
    session = await session_manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionStatusResponse(
        session_id=session.session_id,
        state=session.state.value,
        created_at=session.created_at,
    )


@app.post("/session/{session_id}/reset")
async def reset_session(session_id: str):
    """Reset a session to idle state."""
    session = await session_manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.state = SessionState.IDLE
    session.abort_event.clear()
    await session_manager.update(session)
    return {"status": "reset", "session_id": session_id}


# =============================================================================
# Interrupt / Barge-in Endpoint
# =============================================================================


@app.post("/interrupt", response_model=InterruptResponse)
async def interrupt(request: InterruptRequest) -> InterruptResponse:
    """
    Interrupt the current conversation - barge-in.

    Publishes to Redis Pub/Sub channel barge_in:{session_id} which
    genki-voice subscribes to for immediate interrupt.
    """
    session = await session_manager.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Publish barge-in event to Redis
    await event_bus.publish_barge_in(request.session_id)

    # Abort the session locally
    await session_manager.abort(request.session_id)

    return InterruptResponse(
        session_id=request.session_id,
        status="aborted",
        message="Interrupt signal sent",
    )


# =============================================================================
# Voice Conversation Endpoint
# =============================================================================


@app.post("/v1/voice/conversation")
async def voice_conversation(
    request: VoiceConversationRequest,
) -> StreamingResponse:
    """
    Streaming voice conversation endpoint.

    Forwards audio to genki-voice service and streams TTS audio back.
    Uses concurrent processing: transcription triggers LLM + TTS in parallel.
    """
    if not event_bus or not session_manager:
        raise HTTPException(status_code=503, detail="Service not ready")

    session = await session_manager.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Update session state to processing
    session.state = SessionState.PROCESSING
    await session_manager.update(session)

    async def audio_stream() -> AsyncGenerator[bytes, None]:
        import httpx

        abort_event = asyncio.Event()

        # Subscribe to barge-in events
        barge_in_queue = await event_bus.subscribe_barge_in(request.session_id)

        async def listen_for_barge_in():
            while True:
                try:
                    event = await asyncio.wait_for(barge_in_queue.get(), timeout=0.5)
                    if event.get("session_id") == request.session_id:
                        abort_event.set()
                        break
                except asyncio.TimeoutExpired:
                    continue

        barge_in_task = asyncio.create_task(listen_for_barge_in())

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
                # Forward to genki-voice
                voice_response = await client.post(
                    f"{VOICE_SERVICE_URL}/v1/voice/conversation",
                    json={
                        "audio_data": request.audio_data,
                        "session_id": request.session_id,
                        "voice_id": request.voice_id,
                        "speed": request.speed,
                    },
 timeout=120.0,
                )

                if voice_response.status_code != 200:
                    raise HTTPException(
                        status_code=voice_response.status_code,
                        detail="Voice service error",
                    )

                # Stream audio chunks back to client
                async for chunk in voice_response.aiter_bytes(chunk_size=4096):
                    if abort_event.is_set():
                        break
                    yield chunk

 except asyncio.CancelledError:
            abort_event.set()
            raise
        finally:
            barge_in_task.cancel()
            try:
                await barge_in_task
            except asyncio.CancelledError:
                pass
            await event_bus.unsubscribe(f"barge_in:{request.session_id}")

    return StreamingResponse(
        audio_stream(),
        media_type="application/octet-stream",
        headers={
            "X-Session-ID": request.session_id,
            "Transfer-Encoding": "chunked",
        },
    )


# =============================================================================
# Entry Point
# =============================================================================


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=SERVICE_PORT)
