import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

from services.llm_gateway import _strip_fences, _validate_json, LLMGateway, GatewayResponse
from services.checkpoint import CheckpointStore, _MemoryStore
from services.goal_agent import (
    intake_node,
    apply_clarification,
    classify_node,
    assembly_node,
    run_goal_agent,
    GoalState,
)
from services.search import _credibility_score, _cache_get, _cache_set


def test_strip_fences_and_json_validation():
    raw_markdown = '```json\n{"modules": ["Python", "DSA"]}\n```'
    stripped = _strip_fences(raw_markdown)
    assert stripped == '{"modules": ["Python", "DSA"]}'
    
    parsed = _validate_json(raw_markdown)
    assert parsed == {"modules": ["Python", "DSA"]}
    
    assert _validate_json("not valid json at all") is None


def test_credibility_score():
    assert _credibility_score("https://gate2025.iitr.ac.in/syllabus") >= 3
    assert _credibility_score("https://upsc.gov.in/notifications") >= 3
    assert _credibility_score("https://random-blog.xyz/post") <= 1
    assert _credibility_score("") == 0


def test_search_cache():
    key = ("test query", 3)
    _cache_set(key, "Sample Cached Snippets")
    assert _cache_get(key) == "Sample Cached Snippets"
    assert _cache_get(("non existent query", 3)) is None


@pytest.mark.asyncio
async def test_checkpoint_store():
    store = CheckpointStore()
    test_state = {"user_id": "test_user", "stage": "research", "score": 0.85}
    await store.save("run_123", "research", test_state)
    
    loaded = await store.load("run_123")
    assert loaded is not None
    assert loaded["stage"] == "research"
    assert loaded["state"]["score"] == 0.85
    
    await store.clear("run_123")
    assert await store.load("run_123") is None


def test_intake_node_slot_extraction():
    state: GoalState = {
        "run_id": "test_run",
        "user_id": "u1",
        "raw_goal": "I want to prepare for GATE CS in 6 months studying 3 hours/day in Hindi as a beginner",
        "goal_type": None,
        "clarified_goal": None,
        "needs_clarification": False,
        "clarification_question": None,
        "missing_slots": [],
        "detected_entity": None,
        "realtime_context": None,
        "citations": [],
        "draft_syllabus": None,
        "verified_syllabus": None,
        "verification_passed": False,
        "confidence_score": 0.0,
        "selected_creator": None,
        "selected_creator_name": None,
        "preferred_language": None,
        "target_months": None,
        "daily_hours": None,
        "playlist_url": None,
        "website_url": None,
        "conversation_turns": 0,
        "execution_time_ms": 0.0,
        "stage": "init",
        "stage_index": 0,
        "degraded": False,
        "metrics": {},
        "error": None,
    }
    
    updated = intake_node(state)
    assert updated["preferred_language"] == "Hindi"
    assert updated["target_months"] == 6
    assert updated["daily_hours"] == 3.0
    assert updated["needs_clarification"] is False


def test_intake_user_skip():
    state: GoalState = {
        "run_id": "test_run",
        "user_id": "u1",
        "raw_goal": "Learn Kubernetes",
        "goal_type": None,
        "clarified_goal": None,
        "needs_clarification": True,
        "clarification_question": "What is your timeline?",
        "missing_slots": ["timeline"],
        "detected_entity": None,
        "realtime_context": None,
        "citations": [],
        "draft_syllabus": None,
        "verified_syllabus": None,
        "verification_passed": False,
        "confidence_score": 0.0,
        "selected_creator": None,
        "selected_creator_name": None,
        "preferred_language": None,
        "target_months": None,
        "daily_hours": None,
        "playlist_url": None,
        "website_url": None,
        "conversation_turns": 1,
        "execution_time_ms": 0.0,
        "stage": "intake",
        "stage_index": 1,
        "degraded": False,
        "metrics": {},
        "error": None,
    }
    
    skipped = apply_clarification(state, "skip")
    assert skipped["needs_clarification"] is False
    assert skipped["clarified_goal"] == "Learn Kubernetes"


def test_assembly_confidence_score():
    state: GoalState = {
        "run_id": "test_run",
        "user_id": "u1",
        "raw_goal": "GATE DA",
        "goal_type": "exam",
        "clarified_goal": None,
        "needs_clarification": False,
        "clarification_question": None,
        "missing_slots": [],
        "detected_entity": "GATE DA Data Science and Artificial Intelligence",
        "realtime_context": "Syllabus details",
        "citations": ["https://iit.ac.in", "https://gate.iit.ac.in"],
        "draft_syllabus": [{"title": "Mod 1", "parts": ["Topic A || vid123"]}],
        "verified_syllabus": [{"title": "Mod 1", "parts": ["Topic A || vid123"]}],
        "verification_passed": True,
        "confidence_score": 0.0,
        "selected_creator": "CampusX",
        "selected_creator_name": "CampusX",
        "preferred_language": "English",
        "target_months": 3,
        "daily_hours": 2.0,
        "playlist_url": None,
        "website_url": None,
        "conversation_turns": 0,
        "execution_time_ms": 0.0,
        "stage": "youtube_enrich",
        "stage_index": 6,
        "degraded": False,
        "metrics": {},
        "error": None,
    }
    
    assembled = assembly_node(state)
    assert assembled["stage"] == "done"
    assert assembled["confidence_score"] >= 0.8


@pytest.mark.asyncio
async def test_run_goal_agent_clarification_stage():
    queue = asyncio.Queue()
    res = await run_goal_agent(
        user_id="test_user",
        raw_goal="Learn Machine Learning",
        progress_queue=queue,
    )
    assert res["needs_clarification"] is True
    assert "timeline" in res["missing_slots"] or "level" in res["missing_slots"]


@pytest.mark.asyncio
async def test_run_goal_agent_full_pipeline_emits_progress():
    queue = asyncio.Queue()
    
    # Mock LLM and search calls to test end-to-end event flow synchronously in tests
    with patch("services.llm_gateway.LLMGateway.call", new_callable=AsyncMock) as mock_call, \
         patch("services.youtube.search_youtube_video_id", new_callable=AsyncMock) as mock_yt, \
         patch("services.search.search_internet", new_callable=AsyncMock) as mock_search, \
         patch("services.groq.extract_clean_context_fast", new_callable=AsyncMock) as mock_clean, \
         patch("services.groq.generate_exam_roadmap_structured", new_callable=AsyncMock) as mock_struct:
        
        mock_clean.return_value = "Verified Topics: Linear Algebra, Probability, Machine Learning"
        
        mock_call.return_value = GatewayResponse(
            text='{"score": 9, "reason": "Good coverage"}',
            model_used="openai/gpt-oss-20b",
            latency_ms=10.0,
        )
        mock_yt.return_value = "mock_vid_999"
        mock_search.return_value = "Title: Official Syllabus\nSource: https://iit.ac.in\nContent: Linear Algebra, Probability, Machine Learning"
        
        mock_mod = MagicMock()
        mock_mod.module_title = "Linear Algebra & Calculus"
        mock_mod.core_topics = ["Eigenvalues", "Matrix Factorization"]
        mock_roadmap = MagicMock()
        mock_roadmap.modules = [mock_mod]
        mock_struct.return_value = mock_roadmap
        
        res = await run_goal_agent(
            user_id="test_user",
            raw_goal="GATE DA preparation in 3 months for beginner",
            progress_queue=queue,
        )
        
        events = []
        while not queue.empty():
            events.append(queue.get_nowait())
            
        stages = [e["stage"] for e in events]
        assert "classify" in stages
        assert "intake" in stages
        assert "detect_entity" in stages
        assert "research" in stages
        assert "roadmap_draft" in stages
        assert "verification" in stages
        assert "youtube_enrich" in stages
        assert "assembly" in stages
        assert res["confidence_score"] > 0
        assert res["stage"] == "done"
