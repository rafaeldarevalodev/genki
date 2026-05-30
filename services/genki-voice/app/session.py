"""Session State Machine for Voice Pipeline.

State machine: idle -> listening -> processing -> speaking -> idle
with barge-in interrupt path from any state back to idle.

Phase 8: Enhanced with AbortController propagation and Redis subscription.
"""
import asyncio
import json
import os
from enum import Enum
from typing import Any


class SessionState(Enum):
    """Voice session states."""
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"


class AbortController:
    """
    Cancellation controller for the voice pipeline.

    Propagates cancellation through ASR -> LLM -> TTS stages.
    Uses asyncio.CancelledError for cooperative cancellation.
    """

    def __init__(self):
        self._cancelled = False
        self._lock = asyncio.Lock()

    def cancel(self):
        """Request cancellation of all pipeline stages."""
        self._cancelled = True

    @property
    def is_cancelled(self) -> bool:
        return self._cancelled

    def check(self):
        """Check if cancelled and raise if so."""
        if self._cancelled:
            raise asyncio.CancelledError("Pipeline cancelled by barge-in")

    async def wait_if_cancelled(self):
        """Wait briefly while checking for cancellation."""
        if self._cancelled:
            raise asyncio.CancelledError("Pipeline cancelled by barge-in")


class SessionStateMachine:
    """
    State machine for voice conversation sessions.

    Manages state transitions and provides abort handling for barge-in.
    Phase 8: Enhanced with AbortController propagation.
    """

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.state = SessionState.IDLE
        self.abort_event = asyncio.Event()
        self.abort_controller = AbortController()
        self._lock = asyncio.Lock()

    async def transition(self, new_state: SessionState) -> bool:
        """
        Transition to a new state.

        Returns:
            True if transition was valid, False otherwise
        """
        async with self._lock:
            valid_transitions = {
                SessionState.IDLE: {SessionState.LISTENING},
                SessionState.LISTENING: {SessionState.PROCESSING, SessionState.IDLE},
                SessionState.PROCESSING: {SessionState.SPEAKING, SessionState.IDLE},
                SessionState.SPEAKING: {SessionState.IDLE},
            }

            if new_state in valid_transitions.get(self.state, set()):
                self.state = new_state
                return True
            return False

    async def abort(self):
        """
        Abort current operation and return to idle.

        Sets the abort event and controller which signals all processing to stop.
        """
        async with self._lock:
            self.abort_event.set()
            self.abort_controller.cancel()
            self.state = SessionState.IDLE

    def reset_abort(self):
        """Reset abort event for new conversation turn."""
        self.abort_event.clear()
        self.abort_controller = AbortController()

    async def wait_for_state(
        self,
        target_state: SessionState,
        timeout: float | None = None,
    ) -> bool:
        """
        Wait for the session to reach a target state.

        Args:
            target_state: State to wait for
            timeout: Optional timeout in seconds

        Returns:
            True if state was reached, False if timeout
        """
        while self.state != target_state:
            if self.abort_event.is_set():
                return False
            await asyncio.sleep(0.1)
        return True


class BargeInHandler:
    """
    Handles barge-in interrupt via Redis Pub/Sub subscription.

    Subscribes to barge_in:{session_id} channel and propagates
    interrupt to the session's abort controller.
    """

    def __init__(self, session: SessionStateMachine, redis_url: str | None = None):
        self.session = session
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379")
        self._redis: Any = None
        self._pubsub: Any = None
        self._listen_task: asyncio.Task | None = None

    async def start(self):
        """Start listening for barge-in events."""
        import redis.asyncio as redis

        self._redis = redis.from_url(self.redis_url, decode_responses=True)
        self._pubsub = self._redis.pubsub()
        await self._pubsub.subscribe(f"barge_in:{self.session.session_id}")

        self._listen_task = asyncio.create_task(self._listen_loop())

    async def stop(self):
        """Stop listening and close connections."""
        if self._listen_task:
            self._listen_task.cancel()
            try:
                await self._listen_task
            except asyncio.CancelledError:
                pass

        if self._pubsub:
            await self._pubsub.unsubscribe(f"barge_in:{self.session.session_id}")
            await self._pubsub.close()

        if self._redis:
            await self._redis.close()

    async def _listen_loop(self):
        """Listen for barge-in events and abort the session."""
        try:
            async for message in self._pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        if data.get("event") == "barge_in" and data.get("session_id") == self.session.session_id:
                            await self.session.abort()
                    except json.JSONDecodeError:
                        pass
        except asyncio.CancelledError:
            raise
        except Exception:
            pass
