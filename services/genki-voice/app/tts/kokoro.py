"""Kokoro TTS Streaming Client.

Connects to a remote Kokoro TTS server and streams audio chunks as they are
generated. Handles abort via asyncio.CancelledError and converts WAV output
to base64 PCM chunks.

Phase 9: Enhanced with sentence-level streaming for concurrent ASR+TTS pipeline.
"""
import asyncio
import base64
import os
import re
from typing import AsyncGenerator

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

    async def stream_synthesize_sentences(
        self,
        text_iterator: AsyncGenerator[str, None],
        voice_id: str = "af_heart",
        speed: float = 1.0,
        abort_event: asyncio.Event | None = None,
    ) -> AsyncGenerator[tuple[bytes, int, int], None]:
        """
        Stream audio chunks sentence-by-sentence as LLM generates partial text.

        This is the KEY latency fix: TTS starts synthesizing each sentence
        as soon as the LLM completes it, rather than waiting for the full text.

        Args:
            text_iterator: Async generator yielding partial text sentences
            voice_id: Kokoro voice identifier
            speed: Speech speed multiplier
            abort_event: Optional event to check for cancellation

        Yields:
            Tuple of (audio_chunk, chunk_index, total_chunks)
        """
        if not self.client:
            raise RuntimeError("Client not initialized. Use async context manager.")

        chunk_index = 0

        async for sentence in text_iterator:
            if abort_event and abort_event.is_set():
                break

            request_data = {
                "text": sentence,
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
                        continue

                    async for audio_chunk in response.aiter_bytes(chunk_size=4096):
                        if abort_event and abort_event.is_set():
                            break
                        if audio_chunk:
                            chunk_index += 1
                            yield (audio_chunk, chunk_index, 0)  # 0 = unknown total

            except asyncio.CancelledError:
                raise
            except Exception:
                # Continue to next sentence on error
                continue


class HTTPException(Exception):
    """httpx.HTTPException alias for use in streaming context."""
    pass
