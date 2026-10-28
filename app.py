import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import gradio as gr
import uvicorn

BACKEND_DIR = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from main import app as api_app
from main import lifespan as backend_lifespan

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("edxiom.space")


@asynccontextmanager
async def space_lifespan(application):
    async with backend_lifespan(application):
        worker_task = None
        stop_event = asyncio.Event()
        if os.getenv("TELEGRAM_BOT_TOKEN"):
            from worker import run_worker

            worker_task = asyncio.create_task(run_worker(stop_event))

            def report_worker_failure(task):
                if task.cancelled():
                    return
                error = task.exception()
                if error:
                    logger.error(
                        "Telegram worker stopped unexpectedly.",
                        exc_info=(type(error), error, error.__traceback__),
                    )

            worker_task.add_done_callback(report_worker_failure)
            logger.info("Started Telegram worker in the Space process.")
        else:
            logger.warning("TELEGRAM_BOT_TOKEN is not set; Telegram worker is disabled.")

        try:
            yield
        finally:
            if worker_task:
                stop_event.set()
                await worker_task


api_app.router.lifespan_context = space_lifespan

# The backend's root route returns JSON; let the Gradio landing page own `/`.
api_app.router.routes[:] = [
    route for route in api_app.router.routes
    if getattr(route, "path", None) != "/"
]

with gr.Blocks(title="Edxiom API") as demo:
    gr.Markdown(
        "# Edxiom API\n"
        "The Edxiom web interface is hosted separately. "
        "This Space serves the Python API at `/api/v1`."
    )
    gr.Markdown(
        "- API health: `/health`\n"
        "- Versioned API: `/api/v1`\n"
        "- OpenAPI docs: `/docs` (development mode only)"
    )

app = gr.mount_gradio_app(api_app, demo, path="/")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "7860")))
