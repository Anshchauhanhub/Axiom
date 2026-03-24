# 🧠 Axiom — AI-Driven Growth Partner

> _"Not a tracker — a proof-of-learning engine."_

Axiom is an agentic learning platform that turns passive learning into an active, accountable dialogue. It **interrogates** your goals, builds a custom roadmap using SOTA LLMs, sends daily interactive nudges via Telegram, and uses AI-generated MCQ gates to **verify** mastery before you advance.

---

## ⚡ Tech Stack (Upgraded)

| Layer | Technology |
|---|---|
| **API Backend** | FastAPI (Python 3.10+) |
| **Database** | PostgreSQL + **pgvector** (Search & Memory) |
| **Bot Interface** | **aiogram 3.19** (Telegram) |
| **LLM Engine** | **Groq** (Llama-3.3-70b-versatile) |
| **Scheduler** | APScheduler (Daily Nudges) |
| **Security** | JWT (Handled via Python-JOSE) + Bcrypt |

---

## 🚀 Quick Start

### 1. Clone & Environment

```bash
git clone https://github.com/Anshchauhanhub/Axiom.git
cd Axiom
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 2. Start Infrastructure

```bash
docker-compose up -d
```

### 3. Configure Environment

```bash
copy .env.example .env
# Essential keys: TELEGRAM_BOT_TOKEN, GROQ_API_KEY, DATABASE_URL
```

### 4. Run Migrations

```bash
alembic upgrade head
```

### 5. Launch

```bash
# Start the FastAPI server (API & Webhooks)
uvicorn app.main:app --reload

# In a separate terminal, start the Telegram bot (Handlers & FSM)
python -m bot.main
```

---

## 📁 Project Architecture

```
Axiom/
├── app/
│   ├── models/       # SQLAlchemy ORM Models (User, Roadmap, Task, Verification)
│   ├── routers/      # FastAPI API Endpoints (Auth, Users, Roadmaps, Webhooks)
│   ├── services/     # Core Logic (Roadmap Gen, MCQ Gen, Scheduler, Gatekeeper)
│   ├── schemas/      # Pydantic V2 Data Models
│   └── llm/          # LLM Clients (Groq integration)
├── bot/
│   ├── handlers/     # Telegram Command & Message Logic (Onboarding, Daily Tasks)
│   ├── middlewares/  # aiogram Auth & Logging Middlewares
│   └── states/       # FSM State Definitions
├── alembic/          # DB Migrations
└── frontend/         # Vanilla JS/CSS SPA
```

---

## 🔑 The Core Loop

1.  **Interrogation** — The bot interviews you via Telegram: goal setting, time commitment, and syllabus analysis.
2.  **Roadmap Generation** — Groq-powered engine generates a structured, time-mapped learning plan stored in Postgres.
3.  **Daily Nudge** — Automated morning reminders via APScheduler ensure you stay on track with your specific daily tasks.
4.  **Gatekeeper** — You can't just "check off" a task. You must pass an AI-generated 5-question MCQ quiz (≥80% score) to verify mastery and unlock the next chapter.

---

## 📜 License

MIT
