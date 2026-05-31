"""
Tests for voice-eval evaluators.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

from src.ai.evaluators.factory import (
    EvaluatorFactory,
    Registry,
    get_evaluator,
)
from src.ai.evaluators.difflib_eval import DifflibEvaluator
from src.ai.evaluators.whisper_eval import WhisperEvaluator


class TestRegistry:
    """Test the evaluator registry."""

    def test_registry_has_difflib(self):
        """Difflib should be registered."""
        assert Registry.is_registered("difflib")

    def test_registry_has_whisper(self):
        """Whisper should be registered."""
        assert Registry.is_registered("whisper")

    def test_registry_list(self):
        """Registry should list all evaluators."""
        names = Registry.list_names()
        assert "difflib" in names
        assert "whisper" in names

    def test_registry_get_difflib(self):
        """Registry should get difflib class."""
        cls = Registry.get("difflib")
        assert cls is not None
        assert cls == DifflibEvaluator

    def test_registry_get_whisper(self):
        """Registry should get whisper class."""
        cls = Registry.get("whisper")
        assert cls is not None
        assert cls == WhisperEvaluator

    def test_registry_get_unknown(self):
        """Registry should return None for unknown."""
        assert Registry.get("unknown") is None


class TestEvaluatorFactory:
    """Test the evaluator factory."""

    def test_create_difflib(self):
        """Factory should create difflib evaluator."""
        EvaluatorFactory.reset()
        eval = EvaluatorFactory.create("difflib")
        assert isinstance(eval, DifflibEvaluator)

    def test_create_whisper(self):
        """Factory should create whisper evaluator."""
        EvaluatorFactory.reset()
        eval = EvaluatorFactory.create("whisper")
        assert isinstance(eval, WhisperEvaluator)

    def test_create_unknown_raises(self):
        """Factory should raise for unknown evaluator."""
        EvaluatorFactory.reset()
        with pytest.raises(ValueError, match="Unknown evaluator"):
            EvaluatorFactory.create("unknown")

    def test_get_default(self):
        """Factory should get default evaluator."""
        EvaluatorFactory.reset()
        eval = EvaluatorFactory.get_default()
        assert isinstance(eval, DifflibEvaluator)

    def test_set_default(self):
        """Factory should set default evaluator."""
        EvaluatorFactory.reset()
        EvaluatorFactory.set_default("whisper")
        assert EvaluatorFactory._default_name == "whisper"
        EvaluatorFactory.set_default("difflib")

    def test_set_default_unknown_raises(self):
        """Factory should raise for unknown default."""
        EvaluatorFactory.reset()
        with pytest.raises(ValueError, match="Cannot set default"):
            EvaluatorFactory.set_default("unknown")

    def test_available_evaluators(self):
        """Factory should list available evaluators."""
        evals = EvaluatorFactory.available_evaluators()
        assert "difflib" in evals
        assert "whisper" in evals


class TestDifflibEvaluator:
    """Test the difflib evaluator."""

    @pytest.fixture
    def evaluator(self):
        """Create evaluator instance."""
        return DifflibEvaluator()

    @pytest.mark.asyncio
    async def test_health_check(self, evaluator):
        """Difflib should always be healthy."""
        result = await evaluator.health_check()
        assert result is True

    @pytest.mark.asyncio
    async def test_evaluate_identical(self, evaluator):
        """Same text should give 100% similarity."""
        audio = b"fake audio data"
        result = await evaluator.evaluate(audio_data=audio, target_text="hello world")
        assert result.score == 100
        assert result.transcription == "hello world"
        assert result.evaluator_name == "difflib-v1"

    @pytest.mark.asyncio
    async def test_evaluate_similar(self, evaluator):
        """Similar text should give high similarity."""
        audio = b"fake audio data"
        result = await evaluator.evaluate(audio_data=audio, target_text="hello world")
        assert result.score > 50
        assert "hello world" in result.transcription

    @pytest.mark.asyncio
    async def test_evaluate_phoneme_details(self, evaluator):
        """Result should include phoneme details."""
        audio = b"fake audio data"
        result = await evaluator.evaluate(audio_data=audio, target_text="hello world")
        assert len(result.phoneme_details) > 0
        assert result.phoneme_details[0].phoneme == "hello"


class TestWhisperEvaluator:
    """Test the whisper evaluator."""

    @pytest.fixture
    def evaluator(self):
        """Create evaluator instance."""
        return WhisperEvaluator()

    @pytest.mark.asyncio
    async def test_health_check(self, evaluator):
        """Whisper health depends on mlx-whisper availability."""
        result = await evaluator.health_check()
        assert isinstance(result, bool)

    @pytest.mark.asyncio
    async def test_name(self, evaluator):
        """Evaluator name should be correct."""
        assert evaluator.name == "whisper-asr"

    @pytest.mark.asyncio
    async def test_version(self, evaluator):
        """Evaluator version should be set."""
        assert evaluator.version == "v1.0.0"


class TestGetEvaluator:
    """Test convenience function."""

    def test_get_evaluator_default(self):
        """get_evaluator should return default."""
        EvaluatorFactory.reset()
        eval = get_evaluator()
        assert isinstance(eval, DifflibEvaluator)

    def test_get_evaluator_by_name(self):
        """get_evaluator should return named evaluator."""
        EvaluatorFactory.reset()
        eval = get_evaluator("whisper")
        assert isinstance(eval, WhisperEvaluator)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
