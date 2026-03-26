# Axiom — Project Scaffolding Walkthrough

## What Was Built

The complete project structure for **Axiom** — 50+ files across 3 main modules.

### Root Config (7 files)
| File | Purpose |
|---|---|
| [.env.example](file:///d:/Projects/Axiom/.env.example) | Environment variable template |
| [.gitignore](file:///d:/Projects/Axiom/.gitignore) | Git ignore rules |
| [requirements.txt](file:///d:/Projects/Axiom/requirements.txt) | All Python dependencies (FastAPI, aiogram, google-genai, etc.) |
| [docker-compose.yml](file:///d:/Projects/Axiom/docker-compose.yml) | PostgreSQL + pgvector container |
| [README.md](file:///d:/Projects/Axiom/README.md) | Project overview & quickstart |
| [alembic.ini](file:///d:/Projects/Axiom/alembic.ini) | DB migration config |
| [alembic/env.py](file:///d:/Projects/Axiom/alembic/env.py) | Async migration runner |

### `app/` — FastAPI Backend (24 files)

| Layer | Files | Purpose |
|---|---|---|
| **Core** | [main.py](file:///d:/Projects/Axiom/app/main.py), [config.py](file:///d:/Projects/Axiom/app/config.py) | App entrypoint & pydantic-settings |
| **DB** | [base.py](file:///d:/Projects/Axiom/app/db/base.py), [session.py](file:///d:/Projects/Axiom/app/db/session.py) | SQLAlchemy async engine & session factory |
| **Models** | [user.py](file:///d:/Projects/Axiom/app/models/user.py), [roadmap.py](file:///d:/Projects/Axiom/app/models/roadmap.py), [task.py](file:///d:/Projects/Axiom/app/models/task.py), [verification.py](file:///d:/Projects/Axiom/app/models/verification.py) | 4 ORM tables matching the schema |
| **Schemas** | [user.py](file:///d:/Projects/Axiom/app/models/user.py), [roadmap.py](file:///d:/Projects/Axiom/app/models/roadmap.py), [task.py](file:///d:/Projects/Axiom/app/models/task.py), [verification.py](file:///d:/Projects/Axiom/app/models/verification.py) | Pydantic request/response models |
| **Routers** | [users.py](file:///d:/Projects/Axiom/app/routers/users.py), [roadmaps.py](file:///d:/Projects/Axiom/app/routers/roadmaps.py), [tasks.py](file:///d:/Projects/Axiom/app/routers/tasks.py), [webhooks.py](file:///d:/Projects/Axiom/app/routers/webhooks.py) | API endpoints with CRUD |
| **Services** | [onboarding.py](file:///d:/Projects/Axiom/bot/states/onboarding.py), [roadmap_gen.py](file:///d:/Projects/Axiom/app/services/roadmap_gen.py), [mcq_gen.py](file:///d:/Projects/Axiom/app/services/mcq_gen.py), [gatekeeper.py](file:///d:/Projects/Axiom/app/services/gatekeeper.py), [scheduler.py](file:///d:/Projects/Axiom/app/services/scheduler.py) | Business logic |
| **LLM** | [client.py](file:///d:/Projects/Axiom/app/llm/client.py), [prompts.py](file:///d:/Projects/Axiom/app/llm/prompts.py), [parsers.py](file:///d:/Projects/Axiom/app/llm/parsers.py) | Gemini Flash integration with Pydantic JSON enforcement |

### `bot/` — Telegram Bot (13 files)

| Layer | Files | Purpose |
|---|---|---|
| **Core** | [main.py](file:///d:/Projects/Axiom/app/main.py) | aiogram dispatcher & long-polling |
| **Middleware** | [auth.py](file:///d:/Projects/Axiom/bot/middlewares/auth.py) | Auto-registers users on first message |
| **Handlers** | [start.py](file:///d:/Projects/Axiom/bot/handlers/start.py), [onboarding.py](file:///d:/Projects/Axiom/bot/states/onboarding.py), [daily_task.py](file:///d:/Projects/Axiom/bot/handlers/daily_task.py), [quiz.py](file:///d:/Projects/Axiom/bot/handlers/quiz.py) | Command & callback handlers |
| **States** | [onboarding.py](file:///d:/Projects/Axiom/bot/states/onboarding.py) | FSM state group for the interview |
| **Keyboards** | [inline.py](file:///d:/Projects/Axiom/bot/keyboards/inline.py), [reply.py](file:///d:/Projects/Axiom/bot/keyboards/reply.py) | MCQ buttons & main menu |

### `tests/` — Test Suite (7 files)

Includes [conftest.py](file:///d:/Projects/Axiom/tests/conftest.py) with sample fixtures, and tests for LLM JSON enforcement (parsers).

## Key Design Decisions

1. **Pydantic JSON enforcement** — Every LLM response is validated through strict Pydantic models in [parsers.py](file:///d:/Projects/Axiom/app/llm/parsers.py) before reaching the database. This is the critical safety net.
2. **Async end-to-end** — `asyncpg`, `async_sessionmaker`, and `aiogram` are all async, so the system handles many concurrent users efficiently.
3. **Session-per-request** — The [get_db()](file:///d:/Projects/Axiom/app/db/session.py#30-39) dependency auto-commits on success and rolls back on error.
4. **`TODO` markers** — Places where the next development phase will connect logic (e.g., wiring the onboarding handler to the roadmap service).

## Next Steps

1. `pip install -r requirements.txt`
2. `docker-compose up -d` (start PostgreSQL)
3. Fill in `.env` with your Telegram bot token and Gemini API key
4. `alembic upgrade head` (create tables)
5. Start building Week 1: echo bot → webhook integration
