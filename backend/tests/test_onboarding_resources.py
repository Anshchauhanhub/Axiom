from unittest.mock import AsyncMock

import pytest

from services.goal_agent import fetch_entity_context_node


def _agent_state(**overrides):
    state = {
        "run_id": "test-run",
        "user_id": "test-user",
        "raw_goal": "Learn data structures",
        "goal_type": "skill",
        "detected_entity": None,
        "clarified_goal": None,
        "website_url": None,
        "playlist_url": None,
        "reference_text": None,
        "resource_warnings": [],
        "citations": [],
        "verification_passed": False,
        "degraded": False,
        "metrics": {},
    }
    state.update(overrides)
    return state


@pytest.mark.asyncio
async def test_uploaded_document_and_youtube_titles_reach_roadmap_context(monkeypatch):
    playlist_fetch = AsyncMock(return_value={
        "title": "Data Structures Course",
        "videos": [
            {"title": "Arrays and Linked Lists", "video_id": "video123"},
            {"title": "Trees and Graphs", "video_id": "video456"},
        ],
    })
    monkeypatch.setattr("services.youtube.get_playlist_data", playlist_fetch)

    state = _agent_state(
        reference_text="PDF syllabus: arrays, linked lists, trees, and graphs.",
        playlist_url="https://www.youtube.com/playlist?list=course123",
    )

    result = await fetch_entity_context_node(state)

    assert "PDF syllabus: arrays, linked lists, trees, and graphs." in result["realtime_context"]
    assert "Arrays and Linked Lists" in result["realtime_context"]
    assert "Trees and Graphs" in result["realtime_context"]
    playlist_fetch.assert_awaited_once_with(state["playlist_url"])


@pytest.mark.asyncio
async def test_website_url_search_results_reach_roadmap_context(monkeypatch):
    search = AsyncMock(return_value="Source: https://example.org/course\nContent: Course modules and topics.")
    clean = AsyncMock(return_value="Course modules and topics from the supplied website.")
    monkeypatch.setattr("services.search.search_internet", search)
    monkeypatch.setattr("services.groq.extract_clean_context_fast", clean)

    state = _agent_state(website_url="https://example.org/course")
    result = await fetch_entity_context_node(state)

    search.assert_awaited_once_with('"https://example.org/course"', max_results=4)
    assert "Course modules and topics from the supplied website." in result["realtime_context"]


@pytest.mark.asyncio
async def test_non_youtube_playlist_url_is_not_fetched(monkeypatch):
    playlist_fetch = AsyncMock()
    monkeypatch.setattr("services.youtube.get_playlist_data", playlist_fetch)

    state = _agent_state(playlist_url="https://127.0.0.1/internal")
    result = await fetch_entity_context_node(state)

    playlist_fetch.assert_not_awaited()
    assert result["resource_warnings"]
