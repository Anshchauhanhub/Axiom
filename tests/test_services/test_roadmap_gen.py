"""
Tests — LLM Parsers (Pydantic Validators).

These tests verify that our JSON enforcement catches invalid LLM output.
"""

import pytest
from pydantic import ValidationError

from app.llm.parsers import validate_roadmap_json, validate_mcq_json


def test_valid_roadmap(sample_roadmap_json):
    """Valid roadmap JSON should pass validation."""
    result = validate_roadmap_json(sample_roadmap_json)
    assert result["title"] == "Learn Python Basics"
    assert len(result["days"]) == 3


def test_roadmap_empty_days():
    """Roadmap with no days should be rejected."""
    bad = {"title": "Empty", "total_days": 0, "days": []}
    with pytest.raises(ValidationError):
        validate_roadmap_json(bad)


def test_valid_mcq(sample_mcq_json):
    """Valid MCQ JSON should pass validation."""
    result = validate_mcq_json(sample_mcq_json)
    assert len(result["questions"]) == 5


def test_mcq_wrong_option_count(sample_mcq_json):
    """MCQ with != 4 options should be rejected."""
    sample_mcq_json["questions"][0]["options"] = ["A", "B"]
    with pytest.raises(ValidationError):
        validate_mcq_json(sample_mcq_json)


def test_mcq_invalid_correct_index(sample_mcq_json):
    """MCQ with correct index out of range should be rejected."""
    sample_mcq_json["questions"][0]["correct"] = 9
    with pytest.raises(ValidationError):
        validate_mcq_json(sample_mcq_json)
