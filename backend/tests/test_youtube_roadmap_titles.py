import json
from unittest.mock import AsyncMock

import pytest

from services.groq import clean_youtube_title, generate_roadmap_from_playlist


@pytest.mark.asyncio
async def test_repeated_youtube_titles_get_generalized_roadmap_names(monkeypatch):
    source_title = (
        "2 Sum Problem - 2 types of the same problem for Interviews - "
        "Brute-Better-Optimal"
    )
    response = {
        "goal_title": "Programming Foundations",
        "roadmap": [
            {
                "title": f"Module 1: {source_title}",
                "parts": [{"title": source_title, "video_index": 0}],
            }
        ],
    }
    call_groq = AsyncMock(return_value=json.dumps(response))
    monkeypatch.setattr("services.groq.call_groq", call_groq)

    roadmap = await generate_roadmap_from_playlist(
        "Programming Foundations",
        [{"title": source_title, "video_id": "video-1"}],
    )

    assert roadmap["roadmap"] == [
        {
            "title": "Module 1: Core Concepts",
            "parts": ["Lesson 1: Key Concepts || video-1"],
        }
    ]


def test_creator_brand_is_removed_from_goal_title():
    assert clean_youtube_title(
        "STRIVER'S A2Z DATA STRUCTURES & ALGORITHMS"
    ) == "Data Structures & Algorithms"
