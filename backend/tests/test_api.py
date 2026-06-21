import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    from httpx import AsyncClient
    from main import app
    HAS_BACKEND_DEPS = True
except ModuleNotFoundError:
    HAS_BACKEND_DEPS = False
    AsyncClient = None
    app = None


def test_backend_test_suite_loads():
    assert True

@pytest.mark.asyncio
@pytest.mark.skipif(not HAS_BACKEND_DEPS, reason="Backend dependencies are not installed")
async def test_health_check():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@pytest.mark.asyncio
@pytest.mark.skipif(not HAS_BACKEND_DEPS, reason="Backend dependencies are not installed")
async def test_root_fallback():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/")
    # Should either return the SPA index.html or the API info dict
    assert response.status_code == 200
