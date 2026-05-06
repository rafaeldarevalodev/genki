import difflib
import logging
import tempfile
import time
from pathlib import Path
from typing import IO, Any

import subprocess
import soundfile as sf
from voxmlx import transcribe as voxtral_transcribe

from src.ai.evaluators.base import (
    PronunciationEvaluator,
    EvaluationError,
)
from src.ai.types import EvaluationResult, PhonemeDetail

logger = logging.getLogger(__name__)

VOXTRAI_MODEL_PATH = Path(__file__).parent.parent.parent.parent.parent / "models" / "Voxtral-2602-mlx"


class MFAEvaluator(PronunciationEvaluator):
    """Pronunciation Evaluator using Voxtral Mini via voXMLX."""

    def __init__(self, timeout: float = 60.0):
        self.timeout = timeout

    @property
    def name(self) -> str:
        return "voXMLX-Voxtral"

    @property
    def version(self) -> str:
        return "v1.0.0"

    async def evaluate(
        self,
        audio_data: bytes | Path | IO[Any],
        target_text: str,
        language: str = "en"
    ) -> EvaluationResult:
        start_time = time.perf_counter()

        audio_bytes = await self._prepare_audio(audio_data)
        transcription = await self._transcribe(audio_bytes)

        similarity = self._calculate_similarity(transcription, target_text)
        phoneme_details = self._generate_phoneme_details(
            transcription, target_text, similarity
        )
        feedback = self._generate_feedback(similarity, transcription, target_text)
        processing_time_ms = (time.perf_counter() - start_time) * 1000

        logger.info(
            f"Voxtral Evaluation: score={similarity}, "
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
        return VOXTRAI_MODEL_PATH.exists()

    async def _prepare_audio(self, audio_data: bytes | Path | IO[Any]) -> bytes:
        if isinstance(audio_data, bytes):
            audio_bytes = audio_data
        elif isinstance(audio_data, Path):
            audio_bytes = audio_data.read_bytes()
        elif hasattr(audio_data, 'read'):
            content = audio_data.read()
            if isinstance(content, bytes):
                audio_bytes = content
            else:
                raise EvaluationError("File-like object must return bytes")
        else:
            raise EvaluationError(f"Unsupported audio type: {type(audio_data)}")

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            temp_path = Path(f.name)

        try:
            # Convert to wav using ffmpeg (handles webm, opus, etc)
            result = subprocess.run(
                ['ffmpeg', '-y', '-i', str(temp_path), 
                 '-ar', '16000', '-ac', '1', 
                 str(temp_path).replace('.wav', '_conv.wav')],
                capture_output=True, timeout=30
            )
            
            if result.returncode == 0:
                # Use converted file
                conv_path = Path(str(temp_path).replace('.wav', '_conv.wav'))
                audio_bytes = conv_path.read_bytes()
                conv_path.unlink(missing_ok=True)
            else:
                # Fallback: try reading original
                audio_bytes = temp_path.read_bytes()
            
            return audio_bytes
        finally:
            temp_path.unlink(missing_ok=True)

    async def _transcribe(self, audio_bytes: bytes) -> str:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            temp_path = Path(f.name)

        try:
            result = voxtral_transcribe(
                str(temp_path),
                model_path=str(VOXTRAI_MODEL_PATH)
            )
            return result.strip()
        finally:
            temp_path.unlink(missing_ok=True)

    def _calculate_similarity(self, transcription: str, target: str) -> float:
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
        similarity: float
    ) -> list[PhonemeDetail]:
        if not target:
            return []

        details: list[PhonemeDetail] = []
        
        # Normalize texts
        target_words = target.lower().strip().split()
        trans_words = transcription.lower().strip().split()
        
        # Estimate timing - assume ~0.4s per word
        total_duration = len(target_words) * 0.4
        current_time = 0.0
        
        for i, target_word in enumerate(target_words):
            # Find matching word in transcription
            matched_idx = -1
            match_type = "error"  # error, warning, correct
            
            for j, trans_word in enumerate(trans_words):
                if target_word == trans_word:
                    matched_idx = j
                    match_type = "correct"
                    break
                elif target_word in trans_word or trans_word in target_word:
                    # Partial match (similar)
                    matched_idx = j
                    match_type = "warning"
                    break
            
            # Determine status based on match
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
            
            details.append(PhonemeDetail(
                phoneme=target_word,
                start=start,
                end=end,
                confidence=confidence,
                status=status
            ))

        return details

    def _generate_feedback(
        self, similarity: float, actual: str, target: str
    ) -> str:
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
