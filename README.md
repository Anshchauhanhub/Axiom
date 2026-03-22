# 🧠 Axiom — AI-Driven Growth Partner

> _"Not a tracker — a proof-of-learning engine."_

Axiom is an agentic learning platform that turns passive learning into an active,
accountable dialogue. It **interrogates** your goals, builds a custom roadmap,
sends daily interactive nudges via Telegram, and uses AI-generated MCQ gates to
**verify** you actually mastered a chapter before letting you move on.

---

## ⚡ Tech Stack

| Layer | Technology |
|---|---|
| API | FastAPI |
| Database | PostgreSQL + pgvector |
| Bot Interface | aiogram 3.x (Telegram) |
| Scheduler | APScheduler |
| LLM | Gemini Flash (Google AI Studio) |
| Validation | Pydantic v2 |

---

## 🚀 Quick Start

### 1. Clone & Environment

```bash
git clone https://github.com/your-user/axiom.git
cd axiom
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 2. Start Database

```bash
docker-compose up -d
```

### 3. Configure Environment

```bash
copy .env.example .env
# Edit .env with your Telegram token, Gemini key, etc.
```

### 4. Run Migrations

```bash
alembic upgrade head
```

### 5. Launch

```bash
# Start the FastAPI server
uvicorn app.main:app --reload

# In a separate terminal, start the Telegram bot
python -m bot.main
```

---

## 📁 Project Structure

```
Axiom/
├── app/          # FastAPI backend (routes, services, LLM)
├── bot/          # Telegram bot (aiogram handlers, FSM)
├── alembic/      # Database migrations
├── tests/        # pytest test suite
└── docker-compose.yml
```

---

## 🔑 The Core Loop

1. **Interrogation** — Bot interviews you: goal, hours/day, syllabus upload.
2. **Roadmap** — LLM generates a structured JSON learning plan.
3. **Daily Nudge** — APScheduler sends your task each morning.
4. **Gatekeeper** — Pass an MCQ quiz (≥80%) to verify mastery and advance.

---

## 📄 License

MIT
