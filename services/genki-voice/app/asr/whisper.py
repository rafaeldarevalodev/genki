"""mlx-whisper ASR Client.

Uses ThreadPoolExecutor for CPU-bound transcription with base64 webm audio
input converted via ffmpeg subprocess.

Phase 9: Enhanced with streaming partial transcription support.
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


class ConcurrentASRTTSPipeline:
    """
    Concurrent ASR + TTS pipeline for minimal latency.

    Key latency fix: When transcription completes, LLM and TTS run
    concurrently. TTS starts synthesizing sentences as LLM generates them,
    rather than waiting for the full LLM response.

    Pipeline flow:
    1. ASR transcribes audio -> text
    2. LLM starts generating tokens (partial text)
    3. TTS starts synthesizing each sentence as LLM completes it
    4. Audio chunks are sequenced by timestamp for ordered playback
    """

    def __init__(
        self,
        llm_url: str | None = None,
        kokoro_url: str | None = None,
        whisper_url: str | None = None,
    ):
        self.llm_url = llm_url or os.getenv("LLM_URL", "http://genki-llm:11434")
        self.kokoro_url = kokoro_url or os.getenv("KOKORO_URL", "http://localhost:5001")
        self.whisper_url = whisper_url or os.getenv("WHISPER_URL", "http://localhost:8001")

    async def run(
        self,
        audio_data: str,
        session_id: str,
        voice_id: str = "af_heart",
        speed: float = 1.0,
        abort_event: asyncio.Event | None = None,
    ) -> AsyncGenerator[tuple[bytes, int, int, int], None]:
        """
        Run the concurrent ASR+TTS pipeline.

        Args:
            audio_data: base64 encoded webm audio
            session_id: Session identifier
            voice_id: TTS voice
            speed: Speech speed
            abort_event: Abort event for cancellation

        Yields:
            Tuple of (audio_chunk, chunk_index, total_chunks, timestamp_ms)
        """
        from app.asr.whisper import WhisperASRClient
        from app.tts.kokoro import KokoroTTSClient

        if abort_event and abort_event.is_set():
            return

        # Step 1: Transcribe audio
        asr_client = WhisperASRClient(whisper_url=self.whisper_url)
        async with asr_client:
            transcription = await asr_client.transcribe(audio_data, abort_event)

        if abort_event and abort_event.is_set():
            return

        # Step 2: Start LLM + TTS concurrently
        # LLM generates partial text sentences -> TTS synthesizes each sentence
        tts_client = KokoroTTSClient(kokoro_url=self.kokoro_url)
        async with tts_client:
            # Sentence buffer for TTS
            sentence_queue: asyncio.Queue[str] = asyncio.Queue()
            chunk_index = 0
            total_chunks = 0

            async def llm_streamer():
                """Stream LLM tokens and put sentences in queue."""
                import httpx

                async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
                    try:
                        async with client.stream(
                            "POST",
                            f"{self.llm_url}/api/generate",
                            json={
                                "model": "minimax-2.7",
                                "prompt": transcription,
                                "stream": True,
                            },
                        ) as response:
                            if response.status_code != 200:
                                return

                            buffer = ""
                            async for line in response.aiter_lines():
                                if abort_event and abort_event.is_set():
                                    break
                                if line.startswith("data:"):
                                    data = line[5:].strip()
                                    if data and data != "[DONE]":
                                        buffer += data
                                        # Extract complete sentences
                                        while "." in buffer or "。" in buffer:
                                            sentence, buffer = self._split_sentence(buffer)
                                            if sentence:
                                                await sentence_queue.put(sentence)
                    except Exception:
                        pass
                    finally:
                        await sentence_queue.put("")  # Signal end

            async def tts_streamer():
                """Consume sentences from queue and synthesize TTS."""
                nonlocal chunk_index, total_chunks

                while True:
                    try:
                        sentence = await asyncio.wait_for(
                            sentence_queue.get(), timeout=30.0
                        )
                    except asyncio.TimeoutExpired:
                        if abort_event and abort_event.is_set():
                            break
                        continue

                    if not sentence:  # End signal
                        break

                    if abort_event and abort_event.is_set():
                        break

                    # Synthesize sentence
                    request_data = {
                        "text": sentence,
                        "voice": voice_id,
                        "speed": speed,
                        "stream": True,
                    }

                    try:
                        async with tts_client.client.stream(
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
                                    import time
                                    timestamp_ms = int(time.time() * 1000)
                                    yield (audio_chunk, chunk_index, 0, timestamp_ms)
                    except asyncio.CancelledError:
                        raise
                    except Exception:
                        continue

            # Run LLM and TTS concurrently
            llm_task = asyncio.create_task(llm_streamer())
            tts_task = asyncio.create_task(tts_streamer())

            try:
                async for chunk in tts_streamer():
                    yield chunk
            finally:
                llm_task.cancel()
                tts_task.cancel()
                try:
                    await llm_task
                except asyncio.CancelledError:
                    pass
                try:
                    await tts_task
                except asyncio.CancelledError:
                    pass

    def _split_sentence(self, text: str) -> tuple[str, str]:
        """Split first sentence from text buffer."""
        # Simple sentence splitting on . or 。
        for sep in ["。", ".", "!", "?", "！", "？"]:
            if sep in text:
                idx = text.index(sep)
                sentence = text[: idx + 1].strip()
                remainder = text[idx + 1 :].strip()
                return sentence, remainder
        return "", text
