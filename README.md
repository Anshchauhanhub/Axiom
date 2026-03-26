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

For a complete step-by-step walkthrough for new developers, see the **[Setup Guide](setup_guide.md)**.

### 1. Minimal Backend Setup
```bash
cd backend
python -m venv venv
# Activate venv & install
pip install -r requirements.txt
# Configure .env then:
uvicorn main:app --reload
```

### 2. Minimal Frontend Setup
```bash
npm install
npm run dev
```

---

## 📁 Project Architecture

```
Axiom/
├── backend/
│   ├── routers/      # FastAPI API Endpoints (Auth, Users, Goals, Quiz)
│   ├── services/     # Core Logic (Grok integration, Scheduler)
│   ├── models.py     # SQLAlchemy ORM Models
│   ├── schemas.py    # Pydantic Data Models
│   └── main.py       # App Entry Point
├── src/              # React Frontend (Vite)
│   ├── pages/        # Dashboard, Onboarding, Quiz, Analytics, Settings
│   ├── services/     # API Layer
│   └── context/      # Auth Context
└── README.md
```

---

## 📜 License

MIT
