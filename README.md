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

### 2. Configure Environment

```bash
# Create a .env file in the backend directory
# Essential keys: TELEGRAM_BOT_TOKEN, GROK_API_KEY, DATABASE_URL, JWT_SECRET
```

### 3. Launch

```bash
# Start the FastAPI server
cd backend
uvicorn main:app --reload
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
