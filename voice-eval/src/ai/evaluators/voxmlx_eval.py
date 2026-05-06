import difflib
import logging
import time
from pathlib import Path
from typing import IO, Any

import httpx

from src.ai.evaluators.base import (
    PronunciationEvaluator,
    AudioProcessingError,
    EvaluatorNotAvailableError,
    EvaluationError,
)
from src.ai.types import EvaluationResult, PhonemeDetail

logger = logging.getLogger(__name__)


class VoxMLXEvaluator(PronunciationEvaluator):
    """
    V1 Pronunciation Evaluator using VoxMLX server.
    
    Communicates with local VoxMLX server for speech-to-text,
    then performs string comparison for pronunciation scoring.
    """
    
    def __init__(
        self,
        base_url: str = "http://localhost:10300",
        timeout: float = 30.0,
        similarity_threshold: float = 70.0
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.similarity_threshold = similarity_threshold
    
    @property
    def name(self) -> str:
        return "voxmlx-v1"
    
    @property
    def version(self) -> str:
        return "v1.0.0"
    
    async def evaluate(
        self,
        audio_data: bytes | Path | IO[Any],
        target_text: str,
        language: str = "en"
    ) -> EvaluationResult:
        """
        Evaluate pronunciation using VoxMLX for transcription + string comparison.
        
        Args:
            audio_data: Audio input (bytes, Path, or file-like)
            target_text: Expected text
            language: ISO language code
            
        Returns:
            EvaluationResult with score, transcription, and feedback
        """
        start_time = time.perf_counter()
        
        # Convert audio to bytes if needed
        audio_bytes = await self._prepare_audio(audio_data)
        
        # Transcribe using VoxMLX
        transcription = await self._transcribe(audio_bytes, language)
        
        # Calculate similarity
        similarity = self._calculate_similarity(transcription, target_text)
        
        # Generate phoneme-level details (V1 - basic approximation)
        phoneme_details = self._generate_phoneme_details(
            transcription, target_text, similarity
        )
        
        # Calculate feedback
        feedback = self._generate_feedback(similarity, transcription, target_text)
        
        # Calculate processing time
        processing_time_ms = (time.perf_counter() - start_time) * 1000
        
        logger.info(
            f"Evaluation completed: score={similarity}, "
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
            evaluator_name=self.name
        )
    
    async def health_check(self) -> bool:
        """Check if VoxMLX server is available."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                return response.status_code == 200
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            logger.warning(f"Health check failed: {e}")
            return False
    
    async def _prepare_audio(
        self, audio_data: bytes | Path | IO[Any]
    ) -> bytes:
        """Convert various audio inputs to bytes."""
        try:
            if isinstance(audio_data, bytes):
                return audio_data
            elif isinstance(audio_data, Path):
                return audio_data.read_bytes()
            elif hasattr(audio_data, 'read'):
                content = audio_data.read()
                if isinstance(content, bytes):
                    return content
                raise AudioProcessingError(
                    "File-like object must return bytes"
                )
            else:
                raise AudioProcessingError(
                    f"Unsupported audio data type: {type(audio_data)}"
                )
        except Exception as e:
            if isinstance(e, AudioProcessingError):
                raise
            raise AudioProcessingError(f"Failed to prepare audio: {e}")
    
    async def _transcribe(
        self, audio_bytes: bytes, language: str
    ) -> str:
        """Send audio to VoxMLX server for transcription."""
        try:
            files = {
                "file": ("audio.wav", audio_bytes, "audio/wav")
            }
            data = {
                "language": language,
                "task": "transcribe"
            }
            
            async with httpx.AsyncClient(
                timeout=self.timeout
            ) as client:
                response = await client.post(
                    f"{self.base_url}/transcribe",
                    files=files,
                    data=data
                )
                response.raise_for_status()
                result = response.json()
                
                return result.get("text", "").strip()
                
        except httpx.ConnectError as e:
            raise EvaluatorNotAvailableError(
                f"Cannot connect to VoxMLX server at {self.base_url}: {e}"
            )
        except httpx.TimeoutException as e:
            raise EvaluatorNotAvailableError(
                f"VoxMLX server timeout: {e}"
            )
        except httpx.HTTPStatusError as e:
            raise EvaluationError(
                f"VoxMLX HTTP error {e.response.status_code}: {e}"
            )
        except Exception as e:
            raise EvaluationError(f"Transcription failed: {e}")
    
    def _calculate_similarity(
        self, transcription: str, target: str
    ) -> float:
        """Calculate string similarity (0-100)."""
        if not target:
            return 0.0
        
        # Normalize both strings
        transcribe_norm = transcription.lower().strip()
        target_norm = target.lower().strip()
        
        if not transcribe_norm:
            return 0.0
        
        # Use difflib for sequence matching
        matcher = difflib.SequenceMatcher(
            None, transcribe_norm, target_norm
        )
        similarity = matcher.ratio() * 100
        
        return max(0.0, min(100.0, similarity))
    
    def _generate_phoneme_details(
        self,
        transcription: str,
        target: str,
        similarity: float
    ) -> list[PhonemeDetail]:
        """
        Generate phoneme-level details.
        
        V1: Basic approximation based on string matching.
        V2 (MFA): Would return real phoneme timings.
        """
        if not target:
            return []
        
        details: list[PhonemeDetail] = []
        
        # Simple character-by-character approximation
        # This is a V1 placeholder - real V2 would use MFA
        target_chars = list(target.lower())
        transcribe_chars = list(transcription.lower())
        
        for i, char in enumerate(target_chars):
            # Estimate timing (simple division)
            position = i / max(1, len(target_chars))
            
            # Determine status based on similarity
            if similarity >= 90:
                status = "correct"
                confidence = 0.95
            elif similarity >= self.similarity_threshold:
                status = "warning"
                confidence = 0.7
            else:
                status = "error"
                confidence = 0.4
            
            details.append(PhonemeDetail(
                phoneme=char,
                start=position * 0.5,  # Approximate
                end=(position + 0.1) * 0.5,
                confidence=confidence,
                status=status
            ))
        
        return details
    
    def _generate_feedback(
        self, similarity: float, actual: str, target: str
    ) -> str:
        """Generate human-readable feedback."""
        if similarity >= 95:
            return "Perfect! You sound like a native speaker."
        elif similarity >= 90:
            return "Excellent pronunciation! Keep it up."
        elif similarity >= 80:
            return "Great job! Almost perfect."
        elif similarity >= 70:
            return "Good pronunciation! Keep practicing to refine your accent."
        elif similarity >= 60:
            return "Not bad! Try to say the words more clearly."
        elif similarity >= 50:
            return "You're getting there. Listen to the reference and try again."
        else:
            return (
                f"Keep practicing! Try saying '{target}' "
                f"more slowly and clearly."
            )