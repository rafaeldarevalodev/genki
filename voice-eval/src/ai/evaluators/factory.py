from enum import Enum
from typing import Optional

from src.ai.evaluators.base import PronunciationEvaluator
from src.ai.evaluators.voxmlx_eval import VoxMLXEvaluator
from src.ai.evaluators.mfa_eval import MFAEvaluator


class EvaluatorType(Enum):
    """Available pronunciation evaluator types."""
    
    VOXMLX = "voxmlx"
    MFA = "mfa"


class EvaluatorFactory:
    """
    Factory for creating pronunciation evaluators.
    
    Usage:
        evaluator = EvaluatorFactory.create(EvaluatorType.VOXMLX)
        result = await evaluator.evaluate(audio_bytes, "hello")
    """
    
    _instances: dict[EvaluatorType, PronunciationEvaluator] = {}
    _default: EvaluatorType = EvaluatorType.VOXMLX
    
    @classmethod
    def create(
        cls,
        evaluator_type: EvaluatorType | None = None,
        **config
    ) -> PronunciationEvaluator:
        """
        Create or get evaluator instance.
        
        Args:
            evaluator_type: Type of evaluator to create
            **config: Optional configuration overrides
            
        Returns:
            PronunciationEvaluator instance
        """
        eval_type = evaluator_type or cls._default
        
        # Create new instance if not cached or config provided
        if eval_type not in cls._instances or config:
            cls._instances[eval_type] = cls._create_instance(
                eval_type, config
            )
        
        return cls._instances[eval_type]
    
    @classmethod
    def _create_instance(
        cls,
        evaluator_type: EvaluatorType,
        config: dict
    ) -> PronunciationEvaluator:
        """Create evaluator instance based on type."""
        match evaluator_type:
            case EvaluatorType.VOXMLX:
                return VoxMLXEvaluator(**config)
            case EvaluatorType.MFA:
                return MFAEvaluator(**config)
            case _:
                raise ValueError(f"Unknown evaluator type: {evaluator_type}")
    
    @classmethod
    def get_default(cls) -> PronunciationEvaluator:
        """Get default evaluator instance."""
        return cls.create(cls._default)
    
    @classmethod
    def set_default(cls, evaluator_type: EvaluatorType) -> None:
        """Set default evaluator type."""
        cls._default = evaluator_type
    
    @classmethod
    async def health_check_all(cls) -> dict[str, bool]:
        """Check health of all evaluators."""
        results: dict[str, bool] = {}
        
        for eval_type in EvaluatorType:
            try:
                evaluator = cls.create(eval_type)
                results[eval_type.value] = await evaluator.health_check()
            except Exception as e:
                results[eval_type.value] = False
        
        return results
    
    @classmethod
    def available_evaluators(cls) -> list[str]:
        """List available evaluator types."""
        return [e.value for e in EvaluatorType]


# Convenience functions
def get_evaluator(
    evaluator_type: EvaluatorType | None = None,
    **config
) -> PronunciationEvaluator:
    """Get evaluator instance."""
    return EvaluatorFactory.create(evaluator_type, **config)


def get_default_evaluator() -> PronunciationEvaluator:
    """Get default evaluator instance."""
    return EvaluatorFactory.get_default()