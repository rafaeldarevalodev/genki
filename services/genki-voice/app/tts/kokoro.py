"""Kokoro TTS Streaming Client.

Connects to a remote Kokoro TTS server and streams audio chunks as they are
generated. Handles abort via asyncio.CancelledError and converts WAV output
to base64 PCM chunks.
"""
import asyncio
import base64
import os
from typing import AsyncGenerator, AsyncIterator

import httpx


class KokoroTTSClient:
    """Streaming TTS client for Kokoro server."""

    def __init__(self, kokoro_url: str | None = None):
        self.kokoro_url = kokoro_url or os.getenv("KOKORO_URL", "http://localhost:5001")
        self.client: httpx.AsyncClient | None = None
        self._connected = False

    async def __aenter__(self):
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=5),
        )
        self._connected = True
        return self

    async def __aexit__(self, *args):
        if self.client:
            await self.client.aclose()
            self._connected = False

    async def close(self):
        """Explicit close for use in finally blocks."""
        if self.client:
            await self.client.aclose()
            self._connected = False

    async def stream_synthesize(
        self,
        text: str,
        voice_id: str = "af_heart",
        speed: float = 1.0,
        abort_event: asyncio.Event | None = None,
    ) -> AsyncGenerator[bytes, None]:
        """
        Stream audio chunks from Kokoro TTS server.

        Args:
            text: Text to synthesize
            voice_id: Kokoro voice identifier
            speed: Speech speed multiplier
            abort_event: Optional event to check for cancellation

        Yields:
            Audio chunks as bytes (WAV format)
        """
        if not self.client:
            raise RuntimeError("Client not initialized. Use async context manager.")

        # Check abort before starting
        if abort_event and abort_event.is_set():
            return

        request_data = {
            "text": text,
            "voice": voice_id,
            "speed": speed,
            "stream": True,
        }

        try:
            async with self.client.stream(
                "POST",
                f"{self.kokoro_url}/v1/tts/stream",
                json=request_data,
            ) as response:
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"Kokoro TTS error: {response.text}",
                    )

                async for chunk in response.aiter_bytes(chunk_size=4096):
                    if abort_event and abort_event.is_set():
                        break
                    if chunk:
                        yield chunk

        except asyncio.CancelledError:
            # Propagate cancellation for barge-in handling
            raise
 except Exception as e:
            raise RuntimeError(f"Kokoro TTS streaming failed: {e}")


class HTTPException(Exception):
    """httpx.HTTPException alias for use in streaming context."""
    pass
