import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.main import app
from app.models.user import User
from app.models.part import Part, PartStatus
from app.utils.auth import get_current_user
from app.db.session import get_db

client = TestClient(app)

@pytest.fixture
def mock_user():
    return User(id=uuid.uuid4(), username="testuser", email="test@example.com")

@pytest.fixture
def mock_part():
    return Part(
        id=uuid.uuid4(),
        title="Test Topic",
        status=PartStatus.ACTIVE,
        quiz_data={"questions": [{"question": "Q1", "options": ["A", "B", "C", "D"], "correct": 0}]}
    )

from httpx import AsyncClient, ASGITransport

@pytest.mark.asyncio
async def test_start_quiz_uses_pregenerated_data(mock_user, mock_part):
    # Mock dependencies
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    # Create a mock result object
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_part
    
    mock_db = AsyncMock(spec=AsyncSession)
    mock_db.execute.return_value = mock_result
    app.dependency_overrides[get_db] = lambda: mock_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        with patch("app.routers.quiz.create_quiz_session", new_callable=AsyncMock) as mock_create_session:
            with patch("app.routers.quiz.create_quiz_for_task", new_callable=AsyncMock) as mock_gen:
                response = await ac.post(f"/api/quiz/start/{mock_part.id}")
                
                assert response.status_code == 200
                # Ensure generate wasn't called
                mock_gen.assert_not_called()
                # Ensure Redis session was created with our mock questions
                mock_create_session.assert_called_once()
                args, kwargs = mock_create_session.call_args
                assert kwargs["questions"][0]["question"] == "Q1"

    # Clean up overrides
    app.dependency_overrides.clear()
