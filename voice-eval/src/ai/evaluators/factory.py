"""
Evaluator Factory with registry pattern for extensibility.

New evaluators can be registered via @register_evaluator decorator
without modifying this module or the factory core logic.

Example:
    @register_evaluator("my-evaluator")
    class MyEvaluator(PronunciationEvaluator):
        ...

    # Now "my-evaluator" is available in the factory
    evaluator = EvaluatorFactory.create("my-evaluator")
"""

from enum import Enum
from typing import Optional

from src.ai.evaluators.base import PronunciationEvaluator


class EvaluatorType(Enum):
    """Builtin evaluator types."""

    DIFFLIB = "difflib"


class Registry:
    """
    Simple registry for evaluator implementations.

    Allows registering evaluators without modifying factory code.
    """

    _evaluators: dict[str, type[PronunciationEvaluator]] = {}

    @classmethod
    def register(cls, name: str, evaluator_class: type[PronunciationEvaluator]) -> None:
        """Register an evaluator class with a given name."""
        cls._evaluators[name] = evaluator_class

    @classmethod
    def get(cls, name: str) -> type[PronunciationEvaluator] | None:
        """Get an evaluator class by name."""
        return cls._evaluators.get(name)

    @classmethod
    def list_names(cls) -> list[str]:
        """List all registered evaluator names."""
        return list(cls._evaluators.keys())

    @classmethod
    def is_registered(cls, name: str) -> bool:
        """Check if an evaluator is registered."""
        return name in cls._evaluators


def register_evaluator(name: str):
    """
    Decorator to register an evaluator class.

    Usage:
        @register_evaluator("my-evaluator")
        class MyEvaluator(PronunciationEvaluator):
            ...
    """

    def decorator(cls: type[PronunciationEvaluator]) -> type[PronunciationEvaluator]:
        Registry.register(name, cls)
        return cls

    return decorator


def _register_builtin_evaluators() -> None:
    """Register built-in evaluators."""
    from src.ai.evaluators.difflib_eval import DifflibEvaluator
    from src.ai.evaluators.whisper_eval import WhisperEvaluator

    Registry.register("difflib", DifflibEvaluator)
    Registry.register("whisper", WhisperEvaluator)


# Auto-register builtins on module import
_register_builtin_evaluators()


class EvaluatorFactory:
    """
    Factory for creating pronunciation evaluators.

    Usage:
        # Get default evaluator
        evaluator = EvaluatorFactory.get_default()

        # Get specific evaluator by name
        evaluator = EvaluatorFactory.create("difflib")

        # Create with custom config
        evaluator = EvaluatorFactory.create("difflib", timeout=60.0)
    """

    _instances: dict[str, PronunciationEvaluator] = {}
    _default_name: str = "difflib"

    @classmethod
    def create(
        cls,
        evaluator_name: str | None = None,
        **config,
    ) -> PronunciationEvaluator:
        """
        Create or get an evaluator instance.

        Args:
            evaluator_name: Name of evaluator to create (defaults to "difflib")
            **config: Optional configuration overrides for the evaluator

        Returns:
            PronunciationEvaluator instance
        """
        eval_name = evaluator_name or cls._default_name

        # Check if registered
        evaluator_class = Registry.get(eval_name)
        if evaluator_class is None:
            available = Registry.list_names()
            raise ValueError(
                f"Unknown evaluator: '{eval_name}'. Available: {available}"
            )

        # Create instance with config
        instance_key = f"{eval_name}:{hash(frozenset(config.items()))}"

        if instance_key not in cls._instances or config:
            cls._instances[instance_key] = evaluator_class(**config)

        return cls._instances[instance_key]

    @classmethod
    def get_default(cls) -> PronunciationEvaluator:
        """Get default evaluator instance."""
        return cls.create(cls._default_name)

    @classmethod
    def set_default(cls, evaluator_name: str) -> None:
        """Set default evaluator by name."""
        if not Registry.is_registered(evaluator_name):
            available = Registry.list_names()
            raise ValueError(
                f"Cannot set default to '{evaluator_name}'. Available: {available}"
            )
        cls._default_name = evaluator_name

    @classmethod
    async def health_check_all(cls) -> dict[str, bool]:
        """Check health of all registered evaluators."""
        results: dict[str, bool] = {}

        for eval_name in Registry.list_names():
            try:
                evaluator = cls.create(eval_name)
                results[eval_name] = await evaluator.health_check()
            except Exception:
                results[eval_name] = False

        return results

    @classmethod
    def available_evaluators(cls) -> list[str]:
        """List all available evaluator names."""
        return Registry.list_names()

    @classmethod
    def reset(cls) -> None:
        """Clear all cached instances (useful for testing)."""
        cls._instances.clear()


# Convenience functions
def get_evaluator(
    evaluator_name: str | None = None,
    **config,
) -> PronunciationEvaluator:
    """Get evaluator instance."""
    return EvaluatorFactory.create(evaluator_name, **config)


def get_default_evaluator() -> PronunciationEvaluator:
    """Get default evaluator instance."""
    return EvaluatorFactory.get_default()
