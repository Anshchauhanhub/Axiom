"""
Tests for onboarding state machine & roadmap guardrails in groq.py.
Run: cd backend && python -m pytest tests/test_onboarding_flow.py -v
"""
import pytest
from services.groq import _clean_json, _normalize_draft_roadmap

class TestOnboardingPhaseGuardrails:

    def test_clean_json_strips_markdown_fences(self):
        raw = "```json\n{\"message\": \"Hello\", \"phase\": \"chat\"}\n```"
        cleaned = _clean_json(raw)
        assert cleaned == "{\"message\": \"Hello\", \"phase\": \"chat\"}"

    def test_normalize_draft_roadmap_handles_dict_items(self):
        raw = [
            {"title": "Module 1", "parts": ["Part 1", "Part 2"]},
            {"title": "Module 2", "parts": "Single string part"}
        ]
        norm = _normalize_draft_roadmap(raw)
        assert len(norm) == 2
        assert norm[0]["title"] == "Module 1"
        assert norm[0]["parts"] == ["Part 1", "Part 2"]
        assert norm[1]["parts"] == ["Single string part"]

    def test_normalize_draft_roadmap_handles_strings(self):
        raw = ["Task 1: Intro", "Task 2: Advanced"]
        norm = _normalize_draft_roadmap(raw)
        assert len(norm) == 2
        assert norm[0]["title"] == "Task 1: Intro"
        assert norm[0]["parts"] == []
