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


@pytest.mark.asyncio
async def test_detect_entity_skips_ambiguity_clarification_when_reference_text_provided():
    from services.goal_agent import detect_entity_node
    # Even if raw_goal has potential candidates, reference_text bypasses clarification
    state = _agent_state(
        raw_goal="GATE",
        reference_text="Detailed Syllabus: Linear Algebra, Probability, Machine Learning"
    )
    result = await detect_entity_node(state)
    assert not result.get("needs_clarification")


@pytest.mark.asyncio
async def test_extract_file_endpoint_text_and_pdf():
    import io
    from fastapi import UploadFile
    from routers.goals import extract_file_endpoint
    from models import User

    fake_user = User(id="user-123", email="scholar@edxiom.ai")

    # Test plain text extraction
    txt_file = UploadFile(
        filename="syllabus.txt",
        file=io.BytesIO(b"Unit 1: Foundations\nUnit 2: Advanced Topics")
    )
    txt_result = await extract_file_endpoint(file=txt_file, user=fake_user)
    assert "Unit 1: Foundations" in txt_result["text"]
    assert txt_result["filename"] == "syllabus.txt"

    # Test PDF extraction via pypdf
    import pypdf
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=72, height=72)
    pdf_bytes_io = io.BytesIO()
    writer.write(pdf_bytes_io)
    pdf_bytes_io.seek(0)

    pdf_file = UploadFile(
        filename="syllabus.pdf",
        file=pdf_bytes_io
    )
    pdf_result = await extract_file_endpoint(file=pdf_file, user=fake_user)
    assert pdf_result["filename"] == "syllabus.pdf"
    assert pdf_result["page_count"] == 1

