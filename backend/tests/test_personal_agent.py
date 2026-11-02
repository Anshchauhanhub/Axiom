import pytest
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from unittest.mock import AsyncMock, MagicMock, patch

from services.personal_agent import _resolve_datetime, process_message
from models import User, PersonalTask

@pytest.fixture
def test_user():
    return User(
        id="11111111-1111-1111-1111-111111111111",
        email="scholar@exiom.live",
        timezone="Asia/Kolkata",
        study_schedule=["12:00", "18:00"],
        current_streak=5
    )

def test_resolve_datetime_timezone_to_utc():
    tz = ZoneInfo("Asia/Kolkata") # UTC+5:30
    # Tomorrow 6:00 PM in IST is 12:30 PM UTC
    dt_utc = _resolve_datetime("tomorrow", "6:00 pm", tz)
    assert dt_utc is not None
    assert dt_utc.tzinfo == timezone.utc

    # Convert back to check local representation
    dt_local = dt_utc.astimezone(tz)
    assert dt_local.hour == 18
    assert dt_local.minute == 0

@pytest.mark.asyncio
async def test_schedule_task_success(test_user):
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    # No existing duplicate
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    with patch("services.personal_agent.call_groq") as mock_groq:
        mock_groq.return_value = (
            '{"action": "schedule_task", "title": "Meet with Professor", "date_str": "tomorrow", "time_str": "6:00 pm", "clarification_needed": false}'
        )
        res = await process_message(test_user, "schedule my meet with Professor tomorrow at 6 pm", mock_db)
        
        assert res["action"] == "schedule_task"
        assert "Meet with Professor" in res["reply"]
        assert res["task"] is not None
        assert mock_db.add.called
        assert mock_db.commit.called

@pytest.mark.asyncio
async def test_schedule_task_rejects_past_time(test_user):
    mock_db = AsyncMock()
    with patch("services.personal_agent.call_groq") as mock_groq:
        # User asks for yesterday or passed hour
        mock_groq.return_value = (
            '{"action": "schedule_task", "title": "Old Meet", "date_str": "2020-01-01", "time_str": "10:00 am", "clarification_needed": false}'
        )
        res = await process_message(test_user, "schedule old meet on 2020-01-01 at 10am", mock_db)
        assert res["action"] == "rejected_past"
        assert "already passed" in res["reply"]

@pytest.mark.asyncio
async def test_schedule_task_deduplication(test_user):
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    # Existing duplicate task found
    tz = ZoneInfo("Asia/Kolkata")
    now_utc = datetime.now(timezone.utc)
    dup_task = PersonalTask(
        id="22222222-2222-2222-2222-222222222222",
        title="Sync Meet",
        scheduled_at=now_utc + timedelta(hours=3),
        status="active"
    )
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = dup_task
    mock_db.execute.return_value = mock_result

    with patch("services.personal_agent.call_groq") as mock_groq:
        mock_groq.return_value = (
            '{"action": "schedule_task", "title": "Sync Meet", "date_str": "today", "time_str": "6:00 pm", "clarification_needed": false}'
        )
        with patch("services.personal_agent._resolve_datetime") as mock_dt:
            mock_dt.return_value = now_utc + timedelta(hours=3)
            res = await process_message(test_user, "schedule my sync meet today", mock_db)
            assert res["action"] == "duplicate_found"
            assert "already have" in res["reply"]

@pytest.mark.asyncio
async def test_adjust_study_schedule(test_user):
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    with patch("services.personal_agent.call_groq") as mock_groq:
        mock_groq.return_value = (
            '{"action": "adjust_study_schedule", "schedule_times": ["14:00", "20:00"], "clarification_needed": false}'
        )
        res = await process_message(test_user, "adjust my study sessions to 2pm and 8pm", mock_db)
        assert res["action"] == "adjust_study_schedule"
        assert "14:00, 20:00" in res["reply"]
        assert test_user.study_schedule == ["14:00", "20:00"]
        assert mock_db.commit.called

@pytest.mark.asyncio
async def test_clarification_on_ambiguous_request(test_user):
    mock_db = AsyncMock()
    with patch("services.personal_agent.call_groq") as mock_groq:
        mock_groq.return_value = (
            '{"action": "schedule_task", "title": "Meeting", "clarification_needed": true, "clarification_question": "What time would you like to schedule the meeting?"}'
        )
        res = await process_message(test_user, "schedule meeting", mock_db)
        assert res["action"] == "clarification"
        assert "What time" in res["reply"]

@pytest.mark.asyncio
async def test_schedule_natural_language_tournament(test_user):
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    # Even if Groq classification fails/throws, the fallback regex extracts the tournament!
    with patch("services.personal_agent.call_groq", side_effect=Exception("API connection error")):
        res = await process_message(test_user, "i have a tournament at 6pm of football", mock_db)
        assert res["action"] == "schedule_task"
        assert "Scheduled" in res["reply"]
        assert res["task"] is not None
        assert mock_db.add.called
        assert mock_db.commit.called

@pytest.mark.asyncio
async def test_multiturn_clarification_scheduling(test_user):
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    history = [
        {"role": "user", "content": "schedule my time at 6 pm"},
        {"role": "assistant", "content": "What would you like to schedule at 6 pm?"}
    ]

    with patch("services.personal_agent.call_groq") as mock_groq:
        mock_groq.return_value = (
            '{"action": "schedule_task", "title": "Gaming Tournament", "date_str": "today", "time_str": "6:00 PM", "clarification_needed": false}'
        )
        res = await process_message(test_user, "for gaming tournament", mock_db, history=history)
        assert res["action"] == "schedule_task"
        assert "Gaming Tournament" in res["reply"]
        assert res["task"]["title"] == "Gaming Tournament"
        assert mock_db.add.called
        assert mock_db.commit.called


