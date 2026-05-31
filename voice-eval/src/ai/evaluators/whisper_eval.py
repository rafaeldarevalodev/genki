"""
Whisper-based pronunciation evaluator using mlx-whisper.

Uses mlx-whisper for speech-to-text transcription on Apple Silicon,
then compares the transcription with the target text using difflib.
"""

import asyncio
import difflib
import logging
import os
import tempfile
import threading
import time
from pathlib import Path
from typing import IO, Any

import soundfile as sf

from src.ai.evaluators.base import (
    PronunciationEvaluator,
    AudioProcessingError,
    EvaluationError,
)
from src.ai.types import EvaluationResult, PhonemeDetail

logger = logging.getLogger(__name__)

MLX_WHISPER_MODEL = "mlx-community/whisper-large-v3-mlx"


class ModelCache:
    """Thread-safe lazy loader for mlx-whisper model."""

    def __init__(self):
        self._model = None
        self._lock = threading.Lock()
        self._loading = False

    def load(self) -> Any | None:
        """Load mlx-whisper model if not already loaded."""
        if self._model is not None:
            return self._model

        with self._lock:
            if self._model is not None:
                return self._model

            if self._loading:
                return None

            self._loading = True
            try:
                import mlx_whisper

                self._model = {"module": mlx_whisper, "loaded": True}
                logger.info("mlx-whisper model loaded")
                return self._model
            except Exception as e:
                logger.warning(f"Failed to load mlx-whisper: {e}")
                self._model = None
                return None
            finally:
                self._loading = False


_model_cache = ModelCache()


class WhisperEvaluator(PronunciationEvaluator):
    """
    Pronunciation evaluator using mlx-whisper for transcription.

    This evaluator uses mlx-whisper (Apple Silicon optimized) to transcribe
    the user's audio, then compares with target text using difflib.

    Falls back to difflib-only mode if whisper is not available.
    """

    def __init__(self, timeout: float = 60.0):
        self.timeout = timeout

    @property
    def name(self) -> str:
        return "whisper-asr"

    @property
    def version(self) -> str:
        return "v1.0.0"

    async def evaluate(
        self,
        audio_data: bytes | Path | IO[Any],
        target_text: str,
        language: str = "en",
    ) -> EvaluationResult:
        """Evaluate pronunciation by transcribing with whisper then comparing."""
        start_time = time.perf_counter()

        audio_bytes = await self._prepare_audio(audio_data)
        wav_path = await self._save_temp_wav(audio_bytes)

        try:
            transcription = await self._transcribe(wav_path)
        finally:
            if wav_path and os.path.exists(wav_path):
                os.unlink(wav_path)

        similarity = self._calculate_similarity(transcription, target_text)
        phoneme_details = self._generate_phoneme_details(
            transcription, target_text, similarity
        )
        feedback = self._generate_feedback(similarity, transcription, target_text)
        processing_time_ms = (time.perf_counter() - start_time) * 1000

        logger.info(
            f"Whisper Evaluation: score={similarity}, "
            f"transcription='{transcription}', "
            f"time={processing_time_ms:.2f}ms"
        )

        return EvaluationResult(
            score=int(similarity),
            transcription=transcription,
            target_text=target_text,
            phoneme_details=phoneme_details,
            feedback_text=feedback,
            processing_time_ms=processing_time_ms,
            evaluator_name=self.name,
        )

    async def health_check(self) -> bool:
        """Check if mlx-whisper is available and model is cached."""
        model = _model_cache.load()
        return model is not None

    async def _prepare_audio(self, audio_data: bytes | Path | IO[Any]) -> bytes:
        """Convert various audio inputs to WAV bytes."""
        if isinstance(audio_data, bytes):
            audio_bytes = audio_data
        elif isinstance(audio_data, Path):
            audio_bytes = audio_data.read_bytes()
        elif hasattr(audio_data, "read"):
            content = audio_data.read()
            if isinstance(content, bytes):
                audio_bytes = content
            else:
                raise AudioProcessingError("File-like object must return bytes")
        else:
            raise AudioProcessingError(f"Unsupported audio type: {type(audio_data)}")

        return audio_bytes

    async def _save_temp_wav(self, audio_bytes: bytes) -> str | None:
        """Save audio bytes to temp WAV file, converting if needed."""
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_bytes)
                return tmp.name
        except Exception as e:
            logger.error(f"Failed to save temp audio: {e}")
            return None

    async def _transcribe(self, wav_path: str) -> str:
        """Transcribe audio using mlx-whisper."""
        model = _model_cache.load()

        if model is None:
            logger.warning("Whisper not available, using placeholder transcription")
            return ""

        loop = asyncio.get_event_loop()

        def _do_transcribe():
            try:
                import mlx_whisper

                result = mlx_whisper.transcribe(
                    wav_path,
                    path_or_hf_repo=MLX_WHISPER_MODEL,
                    language="en",
                )
                return result.get("text", "").strip()
            except Exception as e:
                logger.error(f"Transcription error: {e}")
                raise EvaluationError(f"Transcription failed: {e}")

        try:
            transcription = await asyncio.wait_for(
                loop.run_in_executor(None, _do_transcribe),
                timeout=self.timeout,
            )
            return transcription
        except asyncio.TimeoutError:
            raise EvaluationError(f"Transcription timeout after {self.timeout}s")
        except EvaluationError:
            raise
        except Exception as e:
            raise EvaluationError(f"Transcription failed: {e}")

    def _calculate_similarity(self, transcription: str, target: str) -> float:
        """Calculate string similarity using difflib (0-100)."""
        if not target:
            return 0.0

        trans_norm = transcription.lower().strip()
        target_norm = target.lower().strip()

        if not trans_norm:
            return 0.0

        matcher = difflib.SequenceMatcher(None, trans_norm, target_norm)
        return max(0.0, min(100.0, matcher.ratio() * 100))

    def _generate_phoneme_details(
        self,
        transcription: str,
        target: str,
        similarity: float,
    ) -> list[PhonemeDetail]:
        """Generate word-level details using simple word matching."""
        if not target:
            return []

        details: list[PhonemeDetail] = []

        target_words = target.lower().strip().split()
        trans_words = transcription.lower().strip().split()

        current_time = 0.0

        for target_word in target_words:
            matched_idx = -1
            match_type = "error"

            for j, trans_word in enumerate(trans_words):
                if target_word == trans_word:
                    matched_idx = j
                    match_type = "correct"
                    break
                elif target_word in trans_word or trans_word in target_word:
                    matched_idx = j
                    match_type = "warning"
                    break

            if match_type == "correct":
                status = "correct"
                confidence = 0.95
            elif match_type == "warning":
                status = "warning"
                confidence = 0.6
            else:
                status = "error"
                confidence = 0.3

            start = current_time
            end = current_time + 0.4
            current_time = end

            details.append(
                PhonemeDetail(
                    phoneme=target_word,
                    start=start,
                    end=end,
                    confidence=confidence,
                    status=status,
                )
            )

        return details

    def _generate_feedback(self, similarity: float, actual: str, target: str) -> str:
        """Generate human-readable feedback based on similarity score."""
        if similarity >= 95:
            return "Perfect! You sound like a native speaker."
        elif similarity >= 90:
            return "Excellent! Keep it up."
        elif similarity >= 80:
            return "Great job! Almost perfect."
        elif similarity >= 70:
            return "Good! Keep practicing."
        elif similarity >= 60:
            return "Not bad! Try to say words more clearly."
        elif similarity >= 50:
            return "Getting there. Listen and try again."
        else:
            return f"Practice '{target}' slowly and clearly."
