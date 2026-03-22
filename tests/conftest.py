"""
Pytest fixtures shared across all Axiom tests.
"""

import pytest


@pytest.fixture
def sample_roadmap_json():
    """A valid roadmap JSON plan for testing."""
    return {
        "title": "Learn Python Basics",
        "total_days": 3,
        "days": [
            {"day": 1, "title": "Variables & Types", "description": "Learn basic data types", "duration_hours": 2},
            {"day": 2, "title": "Control Flow", "description": "if/else, loops", "duration_hours": 2},
            {"day": 3, "title": "Functions", "description": "def, args, return", "duration_hours": 2},
        ],
    }


@pytest.fixture
def sample_mcq_json():
    """A valid MCQ quiz JSON for testing."""
    return {
        "questions": [
            {
                "question": "What is a variable?",
                "options": ["A box", "A container for data", "A function", "A loop"],
                "correct": 1,
            },
            {
                "question": "Which is a data type?",
                "options": ["for", "int", "def", "import"],
                "correct": 1,
            },
            {
                "question": "What does len() return?",
                "options": ["Type", "Length", "Sum", "Max"],
                "correct": 1,
            },
            {
                "question": "How to define a function?",
                "options": ["fun", "func", "def", "define"],
                "correct": 2,
            },
            {
                "question": "What is print()?",
                "options": ["A variable", "A loop", "A built-in function", "A class"],
                "correct": 2,
            },
        ]
    }
