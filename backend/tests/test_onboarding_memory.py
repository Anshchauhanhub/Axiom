import pytest
from unittest.mock import AsyncMock, patch
from schemas import OnboardingChatRequest, ChatMessage
from routers.goals import onboarding_chat
from models import User, ChatSession

@pytest.mark.asyncio
async def test_onboarding_chat_updates_profile():
    # Mock database session
    db_mock = AsyncMock()
    
    # Mock user and session
    user = User(
        id="c56a4180-8608-4105-a4d0-f6ca74f17952",
        email="test@example.com",
        study_profile={"education_stage": "College Student"}
    )
    req = OnboardingChatRequest(
        session_id="session-123",
        messages=[ChatMessage(role="user", content="I want to study for GATE DA 2026. I am in my 3rd year.")]
    )
    
    # Mock Groq response containing profile update
    mock_response = {
        "message": "Alright, GATE DA requires 300+ hours. Since you only study 1 hour a day, we need to adjust.",
        "phase": "chat",
        "mood": 3,
        "study_profile_update": {
            "target_exam": "GATE DA 2026",
            "college_year": "3rd Year",
            "study_hours_per_day": 1.0
        }
    }
    
    # Mock dependencies inside onboarding_chat
    with patch("services.groq.generate_onboarding_response", new_callable=AsyncMock) as mock_gen, \
         patch("routers.goals.get_current_user", return_value=user), \
         patch("routers.goals.get_db", return_value=db_mock):
        
        mock_gen.return_value = mock_response
        
        # We need mock DB returns for Goal and ChatSession select queries
        from unittest.mock import MagicMock
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_result.scalars.return_value.first.return_value = ChatSession(id="session-123")
        db_mock.execute.return_value = mock_result
        
        response = await onboarding_chat(req=req, user=user, db=db_mock)
        
        # Verify the study profile was correctly updated and merged
        assert user.study_profile["education_stage"] == "College Student"
        assert user.study_profile["target_exam"] == "GATE DA 2026"
        assert user.study_profile["college_year"] == "3rd Year"
        assert user.study_profile["study_hours_per_day"] == 1.0
        
        # Check database commit was called
        assert db_mock.commit.called
