import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import spaces
import gradio as gr

BACKEND_DIR = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from main import app as api_app
from main import lifespan as backend_lifespan

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("edxiom.space")


@spaces.GPU(duration=10)
def zero_gpu_check():
    return "ZeroGPU integration is available."


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

# The frontend is served by Vercel; keep the Space root dedicated to Gradio.
api_app.router.routes[:] = [
    route for route in api_app.router.routes
    if getattr(route, "path", None) != "/"
    and not (
        getattr(route, "path", None) == "/{full_path:path}"
        and getattr(route, "name", None) == "serve_spa"
    )
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
    zero_gpu_button = gr.Button("Check ZeroGPU")
    zero_gpu_result = gr.Textbox(label="ZeroGPU status", interactive=False)
    zero_gpu_button.click(fn=zero_gpu_check, outputs=zero_gpu_result)

demo.queue()
app = gr.mount_gradio_app(api_app, demo, path="/", ssr_mode=False)
spaces.zero.startup()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "7860")))
