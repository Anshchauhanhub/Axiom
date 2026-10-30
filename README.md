---
title: Edxiom API
emoji: 🧠
colorFrom: purple
colorTo: yellow
sdk: gradio
sdk_version: 6.31.0
app_file: app.py
---

# 🧠 Edxiom — AI-Driven Growth Partner

> _"Not a tracker — a proof-of-learning engine."_

Edxiom is an agentic learning platform that turns passive learning into an active, accountable dialogue. It **interrogates** your goals, builds a custom roadmap using SOTA LLMs, sends daily interactive nudges via Telegram, and uses AI-generated MCQ gates to **verify** mastery before you advance.

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

### 1. Start the Backend API
```bash
cd backend
python -m venv venv
pip install -r requirements.txt
# Configure .env then:
uvicorn main:app --reload
```

### 2. Start the Telegram and Scheduler Worker
Run this in a second terminal from the backend directory, with the same virtual environment and `.env`:
```bash
cd backend
python worker.py
```

The API and worker run as separate processes. The worker must run as a single instance to avoid competing Telegram pollers and duplicate scheduled nudges.

### 3. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 📁 Project Architecture

```
Edxiom/
├── backend/
│   ├── routers/      # FastAPI API Endpoints (Auth, Users, Goals, Quiz)
│   ├── services/     # Core Logic (Groq integration, Scheduler)
│   ├── worker.py     # Telegram polling and scheduled nudges
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
