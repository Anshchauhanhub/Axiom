# Vercel frontend and Hugging Face backend

The original Python FastAPI backend stays in `backend/`. A root-level
[`app.py`](./app.py) imports that backend for a Hugging Face **Gradio SDK**
Space, so the Space does not need to use a paid Docker SDK or move the backend
folder.

## Hugging Face Space setup

Create a new Space and select **Gradio**. Push this repository to the Space, or
copy/sync the repository contents while preserving the root `app.py`,
`requirements.txt`, and README metadata. The Space reads the root
[`README.md`](./README.md) metadata (`sdk: gradio`, `app_file: app.py`); the
root requirements file installs the Python dependencies from `backend/`.

The wrapper starts FastAPI on the Space's port 7860, serves a small Gradio
landing page at the Space root, and serves the existing API at `/api/v1`. If a
`TELEGRAM_BOT_TOKEN` is configured, it also starts the existing polling worker
in the same process and stops it when the Space shuts down.

Set these as **Space Secrets**, not as values in repository files:

- `DATABASE_URL`
- `JWT_SECRET`
- `GROQ_API_KEY`
- `TELEGRAM_BOT_TOKEN` (if Telegram is enabled)
- `ALLOWED_ORIGINS` set to the exact Vercel origin
- `FRONTEND_URL` set to the Vercel origin
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` if
  profile image uploads are used
- `SMTP_USERNAME`, `SMTP_PASSWORD`, and optionally `SMTP_SERVER`, `SMTP_PORT`
  if password-reset email is used
- `GOOGLE_CLIENT_ID` if required by the backend's Google login configuration
- Optional model, YouTube, cache, Redis, or search-service values from
  [`backend/.env.example`](./backend/.env.example) when those features are
  enabled

Use a new random JWT secret of at least 32 characters. Do not copy secrets into
the Space README or commit them. If a credential was exposed earlier, rotate it
before deploying. The Hugging Face Space must be allowed to reach the configured
PostgreSQL database over the network.

### Space resource limits

The Space runs one API process and, when enabled, the Telegram polling worker
inside that process. Free Spaces can sleep or restart when inactive; scheduled
Telegram nudges therefore are not guaranteed to run on time on free hardware.
For reliable always-on reminders, the worker needs an always-on host or a
separate scheduled service.

## Vercel frontend

Keep the Vercel project root set to `frontend`, with build command
`npm run build` and output directory `dist`. Set the public frontend variable
`VITE_API_BASE` to the Hugging Face Space URL, for example
`https://<space-owner>-<space-name>.hf.space`, without a trailing slash or
`/api/v1`.

`VITE_API_BASE` is embedded in the browser bundle. Never put database, JWT,
email, AI, Cloudinary, or Telegram credentials in a `VITE_` variable. Configure
the Space's `ALLOWED_ORIGINS` to the exact production Vercel origin. If Vercel
preview deployments need API access, add only the exact preview origins you
intend to allow.

## Verify after deployment

1. Visit `https://<space-owner>-<space-name>.hf.space/health` and expect
   `{"status":"ok"}`.
2. Visit the Vercel site and test signup/login, profile loading, goal and
   roadmap creation, chat, quizzes, file/image uploads, and any other flows
   you rely on.
3. If Telegram is enabled, inspect Space logs for the worker startup message,
   then test `/start`, `/quiz`, `/status`, and `/schedule`.
4. Do not disable the existing Python backend host until these checks pass.
