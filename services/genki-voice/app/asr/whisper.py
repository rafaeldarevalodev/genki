"""mlx-whisper ASR Client.

Uses ThreadPoolExecutor for CPU-bound transcription with base64 webm audio
input converted via ffmpeg subprocess.
"""
import asyncio
import base64
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from typing import AsyncGenerator

import httpx


class WhisperASRClient:
    """ASR client using mlx-whisper for transcription."""

    def __init__(self, whisper_url: str | None = None):
        self.whisper_url = whisper_url or os.getenv("WHISPER_URL", "http://localhost:8001")
        self.executor = ThreadPoolExecutor(max_workers=1)
        self.client: httpx.AsyncClient | None = None

    async def __aenter__(self):
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(60.0))
        return self

    async def __aexit__(self, *args):
        if self.client:
            await self.client.aclose()
        self.executor.shutdown(wait=False)

    async def close(self):
        """Explicit close for use in finally blocks."""
        if self.client:
            await self.client.aclose()

    async def transcribe(
        self,
        audio_data: str,
        abort_event: asyncio.Event | None = None,
    ) -> str:
        """
        Transcribe base64-encoded audio data.

        Args:
            audio_data: base64 encoded webm audio
            abort_event: Optional event to check for cancellation

        Returns:
            Transcription text
        """
        if not self.client:
            raise RuntimeError("Client not initialized. Use async context manager.")

        # Check abort before starting
        if abort_event and abort_event.is_set():
            return ""

        loop = asyncio.get_event_loop()

        def do_transcribe() -> str:
            # Convert webm base64 to wav for whisper
            try:
                audio_bytes = base64.b64decode(audio_data)
                # Write to temp file
                temp_webm = "/tmp/genki_input.webm"
                temp_wav = "/tmp/genki_input.wav"
                with open(temp_webm, "wb") as f:
                    f.write(audio_bytes)

                # Convert to wav using ffmpeg
                result = subprocess.run(
                    [
                        "ffmpeg",
                        "-y",
                        "-i", temp_webm,
                        "-ar", "16000",
                        "-ac", "1",
                        "-c:a", "pcm_s16le",
                        temp_wav,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )

                if result.returncode != 0:
                    return f"[ASR error: ffmpeg failed: {result.stderr}]"

                # Call whisper API
                with open(temp_wav, "rb") as f:
                    files = {"file": ("audio.wav", f, "audio/wav")}
                    response = httpx.post(
                        f"{self.whisper_url}/v1/asr/transcribe",
                        files=files,
                        timeout=60.0,
                    )

                if response.status_code != 200:
                    return f"[ASR error: {response.status_code}]"

                data = response.json()
                return data.get("text", "")

            except subprocess.TimeoutExpired:
                return "[ASR error: ffmpeg timeout]"
            except Exception as e:
                return f"[ASR error: {str(e)}]"

        try:
            text = await loop.run_in_executor(self.executor, do_transcribe)
            return text.strip()
        except asyncio.CancelledError:
            return ""

    async def stream_transcribe(
        self,
        audio_data: str,
        abort_event: asyncio.Event | None = None,
    ) -> AsyncGenerator[str, None]:
        """
        Streaming transcription - yields partial results as they become available.

        For now, returns final transcription. Real streaming would require
        chunked audio input and incremental transcription.
        """
        if abort_event and abort_event.is_set():
            return

        text = await self.transcribe(audio_data, abort_event)
        if text:
            yield text
