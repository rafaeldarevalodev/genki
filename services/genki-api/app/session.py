"""Session Management for genki-api.

Manages voice conversation sessions with state, abort handling, and Redis persistence.
"""
import asyncio
import json
import os
import uuid
from enum import Enum
from typing import Any

import redis.asyncio as redis


class SessionState(Enum):
    """Session states."""
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"


class Session:
    """Voice conversation session."""

    def __init__(
        self,
        session_id: str,
        user_id: str | None = None,
        voice_id: str = "af_heart",
        speed: float = 1.0,
    ):
        self.session_id = session_id
        self.user_id = user_id
        self.voice_id = voice_id
        self.speed = speed
        self.state = SessionState.IDLE
        self.abort_event = asyncio.Event()
        self.created_at = asyncio.get_event_loop().time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "voice_id": self.voice_id,
            "speed": self.speed,
            "state": self.state.value,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Session":
        session = cls(
            session_id=data["session_id"],
            user_id=data.get("user_id"),
            voice_id=data.get("voice_id", "af_heart"),
            speed=data.get("speed", 1.0),
        )
        session.state = SessionState(data.get("state", "idle"))
        session.created_at = data.get("created_at", 0)
        return session


class SessionManager:
    """
    Manages sessions with Redis persistence.

    Sessions are stored in Redis with TTL for automatic cleanup.
    """

    SESSION_PREFIX = "genki:session:"
    SESSION_TTL = 3600  # 1 hour

    def __init__(self, redis_url: str | None = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379")
        self._client: redis.Redis | None = None
        self._local_sessions: dict[str, Session] = {}

    async def connect(self):
        """Connect to Redis."""
        if self._client is None:
            self._client = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )

    async def close(self):
        """Close Redis connection."""
        if self._client:
            await self._client.close()

    def _key(self, session_id: str) -> str:
        """Get Redis key for session."""
        return f"{self.SESSION_PREFIX}{session_id}"

    async def create(self, user_id: str | None = None, **kwargs) -> Session:
        """Create a new session."""
        session_id = str(uuid.uuid4())
        session = Session(session_id=session_id, user_id=user_id, **kwargs)
        self._local_sessions[session_id] = session

        if self._client:
            await self._client.setex(
                self._key(session_id),
                self.SESSION_TTL,
                json.dumps(session.to_dict()),
            )

        return session

    async def get(self, session_id: str) -> Session | None:
        """Get a session by ID."""
        # Check local cache first
        if session_id in self._local_sessions:
            return self._local_sessions[session_id]

        if self._client:
            data = await self._client.get(self._key(session_id))
            if data:
                session = Session.from_dict(json.loads(data))
                self._local_sessions[session_id] = session
                return session

        return None

    async def update(self, session: Session):
        """Update a session."""
        self._local_sessions[session.session_id] = session

        if self._client:
            await self._client.setex(
                self._key(session.session_id),
                self.SESSION_TTL,
                json.dumps(session.to_dict()),
            )

    async def delete(self, session_id: str):
        """Delete a session."""
        self._local_sessions.pop(session_id, None)

        if self._client:
            await self._client.delete(self._key(session_id))

    async def abort(self, session_id: str):
        """Abort a session - sets abort event."""
        session = await self.get(session_id)
        if session:
            session.abort_event.set()
            await self.update(session)
