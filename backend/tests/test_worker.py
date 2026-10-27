import asyncio

import pytest

import worker


class FakeUpdater:
    def __init__(self, events):
        self.events = events

    async def start_polling(self, **kwargs):
        self.events.append(("polling_started", kwargs))

    async def stop(self):
        self.events.append("polling_stopped")


class FakeBotApp:
    def __init__(self):
        self.events = []
        self.updater = FakeUpdater(self.events)
        self.bot = object()

    async def initialize(self):
        self.events.append("initialized")

    async def start(self):
        self.events.append("started")

    async def stop(self):
        self.events.append("stopped")

    async def shutdown(self):
        self.events.append("shutdown")


@pytest.mark.asyncio
async def test_worker_starts_and_stops_polling_and_scheduler(monkeypatch):
    bot_app = FakeBotApp()
    scheduler_events = []
    bot_events = []
    monkeypatch.setattr(worker, "TELEGRAM_BOT_TOKEN", "test-token")
    monkeypatch.setattr(worker, "create_bot_app", lambda: bot_app)
    monkeypatch.setattr(
        worker,
        "set_bot",
        lambda bot: bot_events.append("set" if bot is not None else "cleared"),
    )
    monkeypatch.setattr(worker, "start_scheduler", lambda: scheduler_events.append("started"))
    monkeypatch.setattr(worker, "stop_scheduler", lambda: scheduler_events.append("stopped"))

    stop_event = asyncio.Event()
    stop_event.set()
    await worker.run_worker(stop_event)

    assert bot_app.events == [
        "initialized",
        "started",
        (
            "polling_started",
            {
                "drop_pending_updates": True,
                "timeout": 10,
                "allowed_updates": ["message", "callback_query"],
            },
        ),
        "polling_stopped",
        "stopped",
        "shutdown",
    ]
    assert scheduler_events == ["started", "stopped"]
    assert bot_events == ["set", "cleared"]


@pytest.mark.asyncio
async def test_worker_requires_telegram_token(monkeypatch):
    monkeypatch.setattr(worker, "TELEGRAM_BOT_TOKEN", None)

    with pytest.raises(RuntimeError, match="TELEGRAM_BOT_TOKEN"):
        await worker.run_worker(asyncio.Event())
