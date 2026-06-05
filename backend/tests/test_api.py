import pytest
from httpx import AsyncClient
from main import app

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@pytest.mark.asyncio
async def test_root_fallback():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/")
    # Should either return the SPA index.html or the API info dict
    assert response.status_code == 200
