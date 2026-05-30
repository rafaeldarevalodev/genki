"""Silero VAD Integration.

Voice Activity Detection using Silero VAD model with energy-based fallback.
"""
import os
from typing import AsyncGenerator


class SileroVAD:
    """
    Voice Activity Detection using Silero VAD.

    Energy-based pre-filtering is used as fallback when Silero model
    is not available.
    """

    def __init__(self, model_path: str | None = None):
        self.model_path = model_path or os.getenv("SILERO_MODEL_PATH", "/model_cache/silero_vad.onnx")
        self.model = None
        self._loaded = False

    def load(self):
        """Load Silero VAD model if available."""
        if self._loaded:
            return True

        if not os.path.exists(self.model_path):
            return False

        try:
            # Would load the ONNX model here
            # import onnxruntime as ort
            # self.model = ort.InferenceSession(self.model_path)
            self._loaded = True
            return True
        except Exception:
            return False

    async def detect_speech(
        self,
        audio_chunk: bytes,
        sample_rate: int = 16000,
    ) -> bool:
        """
        Detect if speech is present in audio chunk.

        Args:
            audio_chunk: Raw PCM audio bytes
            sample_rate: Audio sample rate

        Returns:
            True if speech detected, False otherwise
        """
        if not self._loaded:
            # Fallback to energy-based detection
            return self._energy_detection(audio_chunk, sample_rate)

        # Silero VAD detection would go here
        return True

    def _energy_detection(self, audio_chunk: bytes, sample_rate: int) -> bool:
        """
        Energy-based speech detection fallback.

        Calculates RMS energy and compares against threshold.
        """
        import struct

        if len(audio_chunk) < 2:
            return False

        # Convert bytes to int16 samples
        num_samples = len(audio_chunk) // 2
        samples = struct.unpack(f"<{num_samples}h", audio_chunk)

        # Calculate RMS energy
        sum_squared = sum(s * s for s in samples)
        rms = (sum_squared / num_samples) ** 0.5 if num_samples > 0 else 0

        # Threshold for speech detection
        ENERGY_THRESHOLD = 500
        return rms > ENERGY_THRESHOLD

    async def stream_detect(
        self,
        audio_stream: AsyncGenerator[bytes, None],
        sample_rate: int = 16000,
    ) -> AsyncGenerator[bool, None]:
        """
        Stream voice activity detection.

        Args:
            audio_stream: Async generator of audio chunks
            sample_rate: Audio sample rate

        Yields:
            Boolean for each chunk indicating speech presence
        """
        async for chunk in audio_stream:
            detected = await self.detect_speech(chunk, sample_rate)
            yield detected
