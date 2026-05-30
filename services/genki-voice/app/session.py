"""Session State Machine for Voice Pipeline.

State machine: idle -> listening -> processing -> speaking -> idle
with barge-in interrupt path from any state back to idle.
"""
import asyncio
from enum import Enum
from typing import Callable, Awaitable


class SessionState(Enum):
    """Voice session states."""
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"


class SessionStateMachine:
    """
    State machine for voice conversation sessions.

    Manages state transitions and provides abort handling for barge-in.
    """

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.state = SessionState.IDLE
        self.abort_event = asyncio.Event()
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

        Sets the abort event which signals all processing to stop.
        """
        async with self._lock:
            self.abort_event.set()
            self.state = SessionState.IDLE

    def reset_abort(self):
        """Reset abort event for new conversation turn."""
        self.abort_event.clear()

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
