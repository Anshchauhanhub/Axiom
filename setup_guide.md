# 🚀 Axiom AI — Getting Started Guide

This guide will help you set up the Axiom AI full-stack system on your local machine after cloning the repository.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Python 3.10+**
- **Node.js 18+** & **npm**
- **Git**
- **PostgreSQL** (or a [Neon](https://neon.tech) account for a serverless cloud DB)

---

## 🛠️ Step 1: Clone the Repository

```bash
git clone https://github.com/Anshchauhanhub/Axiom.git
cd Axiom
```

---

## 🐍 Step 2: Backend Setup (FastAPI)

1.  **Navigate to the backend directory and create a virtual environment:**
    ```bash
    cd backend
    python -m venv venv
    ```

2.  **Activate the virtual environment:**
    - **Windows**: `.\venv\Scripts\activate`
    - **macOS/Linux**: `source venv/bin/activate`

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure Environment Variables:**
    Create a `.env` file in the `backend/` directory (you can copy `.env.example` as a template):
    ```env
    DATABASE_URL=postgresql+asyncpg://user:pass@host/dbname
    TELEGRAM_BOT_TOKEN=your_bot_token
    GROQ_API_KEY=your_groq_key
    GROQ_BASE_URL=https://api.groq.com/openai/v1
    JWT_SECRET=your_random_secret_string
    ```

5.  **Start the Backend Server:**
    ```bash
    uvicorn main:app --reload
    ```
    The API will be available at `http://localhost:8000`. You can view the interactive documentation at `http://localhost:8000/docs`.

---

## ⚛️ Step 3: Frontend Setup (React/Vite)

1.  **Open a new terminal and navigate to the project root:**
    ```bash
    # (Assuming you are in the root directory)
    npm install
    ```

2.  **Run the Development Server:**
    ```bash
    npm run dev
    ```
    The website will be available at `http://localhost:5173`.

---

## 🤖 Step 4: Telegram Bot Integration

1.  **Message your bot** on Telegram and send `/start`.
2.  **Get your Chat ID** (the bot will reply with it once linked).
3.  **Link your account**:
    - Go to the **Settings** page on the Axiom website.
    - Enter your Chat ID in the **Neural Bridge** section.
    - Now you'll receive interactive nudges based on your study schedule!

---

## 🧠 Core Features to Test
- **Onboarding**: Create an account and select a goal.
- **Roadmap**: Wait a few seconds for Groq to generate your verified mastery path.
- **Quiz**: Click "Start Quiz" on your active part. Remember: You have **15 minutes** to finish, or the session resets for integrity!

---

## 🆘 Troubleshooting
- **Database Connection**: Ensure your `DATABASE_URL` uses the `+asyncpg` driver (e.g., `postgresql+asyncpg://...`).
- **CORS**: The backend is configured to allow `http://localhost:5173` by default.
- **Groq API**: Ensure your API key is active and has credits.
