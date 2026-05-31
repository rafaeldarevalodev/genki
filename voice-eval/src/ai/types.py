from pydantic import BaseModel, Field
from typing import Literal


class PhonemeDetail(BaseModel):
    """Individual phoneme analysis result."""

    phoneme: str = Field(description="Phoneme symbol (ARPABET)")
    start: float = Field(description="Start time in seconds", ge=0.0)
    end: float = Field(description="End time in seconds", gt=0.0)
    confidence: float = Field(description="Confidence score", ge=0.0, le=1.0)
    status: Literal["correct", "warning", "error"] = Field(
        description="Evaluation status for this phoneme"
    )


class EvaluationResult(BaseModel):
    """Complete pronunciation evaluation result."""

    score: int = Field(description="Overall pronunciation score (0-100)", ge=0, le=100)
    transcription: str = Field(description="What the user actually said")
    target_text: str = Field(description="What the user should have said")
    phoneme_details: list[PhonemeDetail] = Field(
        default_factory=list, description="Detailed phoneme-level analysis"
    )
    feedback_text: str = Field(description="Human-readable feedback")
    processing_time_ms: float = Field(description="Processing time in milliseconds")
    evaluator_name: str = Field(description="Name of evaluator used")

    model_config = {
        "json_schema_extra": {
            "example": {
                "score": 85,
                "transcription": "hello",
                "target_text": "hello",
                "phoneme_details": [
                    {
                        "phoneme": "HH",
                        "start": 0.0,
                        "end": 0.1,
                        "confidence": 0.95,
                        "status": "correct",
                    }
                ],
                "feedback_text": "Good pronunciation!",
                "processing_time_ms": 150.5,
                "evaluator_name": "difflib-v1",
            }
        }
    }
