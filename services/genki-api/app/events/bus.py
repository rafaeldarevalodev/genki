"""Redis Pub/Sub Event Bus.

Provides inter-service event communication for the Genki voice pipeline.
Handles events like barge_in, transcription_complete, llm_response_started, etc.
"""
import asyncio
import json
import os
from typing import Any, Callable, Awaitable

import redis.asyncio as redis


class EventBus:
    """
    Redis Pub/Sub event bus for inter-service communication.

    Events published:
    - user_speech_started: User started speaking
    - transcription_complete: ASR finished transcription
    - llm_response_started: LLM started generating response
    - tts_chunk_sent: TTS chunk sent to client
    - barge_in: Interrupt signal for current session
    """

    CHANNEL_BARGE_IN = "barge_in:{session_id}"
    CHANNEL_TRANSCRIPTION = "transcription:{session_id}"
    CHANNEL_LLM = "llm:{session_id}"
    CHANNEL_TTS = "tts:{session_id}"

    def __init__(self, redis_url: str | None = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379")
        self._client: redis.Redis | None = None
        self._pubsub: redis.client.PubSub | None = None
        self._subscriptions: dict[str, asyncio.Queue] = {}
        self._handlers: dict[str, list[Callable[[Any], Awaitable]]] = {}

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
        if self._pubsub:
            await self._pubsub.close()
        if self._client:
            await self._client.close()

    async def publish(self, channel: str, message: dict):
        """
        Publish an event to a channel.

        Args:
            channel: Channel name (supports {session_id} interpolation)
            message: Event payload dict
        """
        if not self._client:
            await self.connect()

        # Interpolate session_id in channel name
        interpolated = channel.format(**message.get("session_id", {}).__dict__) if "session_id" in message else channel

        await self._client.publish(interpolated, json.dumps(message))

    async def subscribe(self, channel: str) -> asyncio.Queue:
        """
        Subscribe to a channel and return a queue for messages.

        Args:
            channel: Channel name to subscribe to

        Returns:
            asyncio.Queue that receives messages from the channel
        """
        if not self._client:
            await self.connect()

        if self._pubsub is None:
            self._pubsub = self._client.pubsub()

        await self._pubsub.subscribe(channel)
        queue: asyncio.Queue = asyncio.Queue()
        self._subscriptions[channel] = queue
        return queue

    async def unsubscribe(self, channel: str):
        """Unsubscribe from a channel."""
        if self._pubsub and channel in self._subscriptions:
            await self._pubsub.unsubscribe(channel)
            del self._subscriptions[channel]

    async def listen(self):
        """Listen for messages on all subscribed channels."""
        if not self._pubsub:
            return

        async for message in self._pubsub.listen():
            if message["type"] == "message":
                channel = message["channel"]
                if channel in self._subscriptions:
                    data = json.loads(message["data"])
                    await self._subscriptions[channel].put(data)

    # -------------------------------------------------------------------------
    # Convenience methods for common events
    # -------------------------------------------------------------------------

    async def publish_barge_in(self, session_id: str):
        """Publish barge-in interrupt for a session."""
        await self.publish(
            f"barge_in:{session_id}",
            {"event": "barge_in", "session_id": session_id},
        )

    async def publish_transcription(self, session_id: str, text: str, confidence: float | None = None):
        """Publish transcription complete event."""
        await self.publish(
            f"transcription:{session_id}",
            {
                "event": "transcription_complete",
                "session_id": session_id,
                "text": text,
                "confidence": confidence,
            },
        )

    async def publish_llm_started(self, session_id: str):
        """Publish LLM response started event."""
        await self.publish(
            f"llm:{session_id}",
            {"event": "llm_response_started", "session_id": session_id},
        )

    async def publish_tts_chunk(self, session_id: str, chunk_index: int, total_chunks: int):
        """Publish TTS chunk sent event."""
        await self.publish(
            f"tts:{session_id}",
            {
                "event": "tts_chunk_sent",
                "session_id": session_id,
                "chunk_index": chunk_index,
                "total_chunks": total_chunks,
            },
        )

    async def subscribe_barge_in(self, session_id: str) -> asyncio.Queue:
        """Subscribe to barge-in events for a session."""
        return await self.subscribe(f"barge_in:{session_id}")
