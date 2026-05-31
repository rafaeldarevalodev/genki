"""
Difflib-based pronunciation evaluator.

A simple evaluator that uses string similarity (difflib) to compare
expected text with transcribed text. This is a fallback/placeholder
evaluator when external ASR services are not available.

Architecture is designed to be extensible - swap the ASR provider
without changing the evaluation logic.
"""

import difflib
import logging
import time
from collections.abc import Callable
from pathlib import Path
from typing import IO, Any

from src.ai.evaluators.base import (
    PronunciationEvaluator,
    AudioProcessingError,
    EvaluationError,
)
from src.ai.types import EvaluationResult, PhonemeDetail

logger = logging.getLogger(__name__)


class DifflibEvaluator(PronunciationEvaluator):
    """
    Pronunciation evaluator using difflib similarity.

    This evaluator requires an external ASR service to transcribe audio.
    Currently uses a placeholder that returns the target text as-is
    (no real ASR). To enable real evaluation, provide an ASR provider.

    Extensible architecture: pass any ASR callable to evaluate().
    """

    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout

    @property
    def name(self) -> str:
        return "difflib-v1"

    @property
    def version(self) -> str:
        return "v1.0.0"

    async def evaluate(
        self,
        audio_data: bytes | Path | IO[Any],
        target_text: str,
        language: str = "en",
        asr_provider: Callable[[bytes], str] | None = None,
    ) -> EvaluationResult:
        """
        Evaluate pronunciation using string similarity.

        Args:
            audio_data: Audio input (bytes, Path, or file-like)
            target_text: The text the user should pronounce
            language: ISO language code (unused, reserved for future)
            asr_provider: Optional callable(audio_bytes) -> str
                        If not provided, uses placeholder that returns target_text.
        """
        start_time = time.perf_counter()

        audio_bytes = await self._prepare_audio(audio_data)

        if asr_provider is not None:
            transcription = await self._transcribe_with_provider(
                audio_bytes, asr_provider
            )
        else:
            transcription = await self._placeholder_transcribe(audio_bytes, target_text)

        similarity = self._calculate_similarity(transcription, target_text)
        phoneme_details = self._generate_phoneme_details(
            transcription, target_text, similarity
        )
        feedback = self._generate_feedback(similarity, transcription, target_text)
        processing_time_ms = (time.perf_counter() - start_time) * 1000

        logger.info(
            f"Difflib Evaluation: score={similarity}, "
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
        """Difflib evaluator is always available (no external dependencies)."""
        return True

    async def _prepare_audio(self, audio_data: bytes | Path | IO[Any]) -> bytes:
        """Convert various audio inputs to bytes."""
        if isinstance(audio_data, bytes):
            return audio_data
        elif isinstance(audio_data, Path):
            return audio_data.read_bytes()
        elif hasattr(audio_data, "read"):
            content = audio_data.read()
            if isinstance(content, bytes):
                return content
            raise AudioProcessingError("File-like object must return bytes")
        else:
            raise AudioProcessingError(f"Unsupported audio type: {type(audio_data)}")

    async def _transcribe_with_provider(
        self, audio_bytes: bytes, asr_provider: Callable[[bytes], str]
    ) -> str:
        """Transcribe using a provided ASR callable."""
        try:
            return await asr_provider(audio_bytes)
        except Exception as e:
            raise EvaluationError(f"ASR transcription failed: {e}")

    async def _placeholder_transcribe(
        self, audio_bytes: bytes, target_text: str
    ) -> str:
        """
        Placeholder transcription when no ASR is available.

        NOTE: This returns the target text as-is, which means
        similarity will be 100% and evaluation is meaningless.
        This is intentional - the architecture is correct but
        ASR must be added for real evaluation.

        To enable real evaluation, provide an ASR provider:
            - mlx-whisper
            - any HTTP-based ASR service
            - a local model
        """
        logger.warning(
            "No ASR provider configured. Using placeholder transcription. "
            "Evaluation will return 100% similarity (not real)."
        )
        return target_text

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

        total_duration = len(target_words) * 0.4
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
