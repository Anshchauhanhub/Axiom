import asyncio
import logging
import signal

from dotenv import load_dotenv

load_dotenv()

from bot import TELEGRAM_BOT_TOKEN, create_bot_app
from services.scheduler import set_bot, start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("edxiom.worker")


async def run_worker(stop_event: asyncio.Event) -> None:
    if not TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN == "your-telegram-bot-token-here":
        raise RuntimeError("TELEGRAM_BOT_TOKEN must be configured for the worker.")

    bot_app = create_bot_app()
    updater = bot_app.updater
    if updater is None:
        raise RuntimeError("Telegram polling updater is not configured.")

    initialized = False
    started = False
    polling_started = False
    try:
        await bot_app.initialize()
        initialized = True
        await bot_app.start()
        started = True
        await updater.start_polling(
            drop_pending_updates=True,
            timeout=10,
            allowed_updates=["message", "callback_query"],
        )
        polling_started = True

        set_bot(bot_app.bot)
        start_scheduler()
        logger.info("Telegram polling and nudge scheduler started.")
        await stop_event.wait()
    finally:
        stop_scheduler()
        set_bot(None)
        try:
            if polling_started:
                await updater.stop()
        finally:
            try:
                if started:
                    await bot_app.stop()
            finally:
                if initialized:
                    await bot_app.shutdown()


def _install_signal_handlers(stop_event: asyncio.Event) -> None:
    loop = asyncio.get_running_loop()
    for signum in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(signum, stop_event.set)
        except NotImplementedError:
            signal.signal(
                signum,
                lambda _signum, _frame: loop.call_soon_threadsafe(stop_event.set),
            )


async def _run() -> None:
    stop_event = asyncio.Event()
    _install_signal_handlers(stop_event)
    await run_worker(stop_event)


if __name__ == "__main__":
    asyncio.run(_run())
