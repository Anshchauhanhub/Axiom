# Axiom AI Deployment Guide

This guide explains how to deploy the Axiom AI platform with the **Backend on Railway** and the **Frontend on Vercel**.

## 1. Backend Deployment (Railway)

1.  **Create a Railway Project**:
    - Go to [Railway](https://railway.app/) and create a new project.
    - Select **"Deploy from GitHub repo"** and choose the `Axiom` repository.
2.  **Add a PostgreSQL Database**:
    - In your Railway project, click **"New"** -> **"Database"** -> **"Add PostgreSQL"**.
    - Railway will automatically add a `DATABASE_URL` to your environment variables.
3.  **Configure Environment Variables**:
    - Go to the **Variables** tab of your backend service.
    - Ensure the following are set:
        - `DATABASE_URL`: (Automatically set by Railway).
        - `ALLOWED_ORIGINS`: Your Vercel URL (e.g., `https://axiom-ai.vercel.app`). *Wait until you deploy to Vercel to get this.*
        - `GROQ_API_KEY`: Your Groq API key.
        - `TELEGRAM_BOT_TOKEN`: Your Telegram Bot token.
        - `JWT_SECRET`: A long random string.
        - `APP_ENV`: `production`
4.  **Deployment Settings**:
    - Railway should automatically detect the `Procfile` in the root and run:
      `web: cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`

## 2. Frontend Deployment (Vercel)

1.  **Create a Vercel Project**:
    - Go to [Vercel](https://vercel.com/) and create a new project.
    - Import the `Axiom` repository.
2.  **Configure Project Settings**:
    - **Root Directory**: Set this to `frontend`.
    - **Build Command**: `npm run build` (should be auto-detected).
    - **Output Directory**: `dist` (should be auto-detected).
3.  **Add Environment Variables**:
    - Go to **Settings** -> **Environment Variables**.
    - Add:
        - `VITE_API_BASE`: Your Railway backend URL (e.g., `https://axiom-backend.up.railway.app`). *No trailing slash.*
4.  **Deploy**:
    - Click **Deploy**.

## 3. Post-Deployment Steps

1.  **Update CORS**: Once your Vercel app is live, copy its URL and update the `ALLOWED_ORIGINS` variable in Railway.
2.  **Database Migration**: The backend is configured to automatically create tables on startup (`init_db()`), so no manual migration is strictly necessary for the first run.

## Troubleshooting

- **CORS Errors**: If the frontend can't talk to the backend, double-check `ALLOWED_ORIGINS` in Railway.
- **WebSocket Issues**: Real-time social feed updates use WebSockets. Ensure `VITE_API_BASE` is set correctly in Vercel.
- **Database Connection**: If the backend fails to start, check the Railway logs for database connection errors.
