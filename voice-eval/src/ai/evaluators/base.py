from abc import ABC, abstractmethod
from pathlib import Path
from typing import IO, Any

from src.ai.types import EvaluationResult


class PronunciationEvaluator(ABC):
    """
    Abstract base class for pronunciation evaluators.

    Defines the contract that all evaluators must implement.
    This enables easy swapping between evaluators without changing client code.

    New evaluators can be registered via the @register_evaluator decorator
    in the factory module without modifying this base class.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Returns evaluator identifier string."""
        pass

    @property
    def version(self) -> str:
        """Returns evaluator version. Override in subclasses."""
        return "v1"

    @abstractmethod
    async def evaluate(
        self, audio_data: bytes | Path | IO[Any], target_text: str, language: str = "en"
    ) -> EvaluationResult:
        """
        Evaluate pronunciation against target text.

        Args:
            audio_data: Audio input (raw bytes, file path, or file-like object)
            target_text: The text the user should pronounce
            language: ISO 639-1 language code (default: "en")

        Returns:
            EvaluationResult with scores, transcription, and feedback

        Raises:
            EvaluatorNotAvailableError: If evaluator service is down
            AudioProcessingError: If audio cannot be processed
            EvaluationError: If evaluation fails
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """
        Check if evaluator service is available and healthy.

        Returns:
            True if evaluator is ready to process requests
        """
        pass

    async def __aenter__(self) -> "PronunciationEvaluator":
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit."""
        pass


class EvaluatorError(Exception):
    """Base exception for evaluator errors."""

    pass


class EvaluatorNotAvailableError(EvaluatorError):
    """Raised when evaluator service is not available."""

    pass


class AudioProcessingError(EvaluatorError):
    """Raised when audio cannot be processed."""

    pass


class EvaluationError(EvaluatorError):
    """Raised when evaluation fails."""

    pass
