import os
import logging
from telegram import Update, Bot, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.error import Conflict
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
    ContextTypes,
)
from sqlalchemy import select
from dotenv import load_dotenv

from database import async_session
from models import User, Goal, Task, Part
from services.groq import generate_mcqs

load_dotenv()

logger = logging.getLogger("edxiom.bot")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command — link or welcome."""
    chat_id = update.effective_chat.id

    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.telegram_chat_id == chat_id)
        )
        user = result.scalar_one_or_none()

    if user:
        await update.message.reply_text(
            f"⚡ *Welcome back to Exiom AI*\n\n"
            f"Your streak: *{user.current_streak} days*\n\n"
            f"Commands:\n"
            f"/quiz — Start a Sudden Death quiz\n"
            f"/status — View your progress\n"
            f"/schedule — View your study schedule",
            parse_mode="Markdown",
        )
    else:
        await update.message.reply_text(
            "🔗 *Exiom AI — Neural Bridge*\n\n"
            f"Your Chat ID: `{chat_id}`\n\n"
            "To connect, go to your Exiom Dashboard → Settings → Link Telegram, "
            "and enter this Chat ID.\n\n"
            "Once linked, I'll send you precision nudges at your scheduled times.",
            parse_mode="Markdown",
        )


async def quiz_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /quiz — show available parts to quiz on."""
    chat_id = update.effective_chat.id

    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.telegram_chat_id == chat_id)
        )
        user = result.scalar_one_or_none()

    if not user:
        await update.message.reply_text("❌ Account not linked. Use /start for instructions.")
        return

    async with async_session() as db:
        # Find active parts
        goals = await db.execute(select(Goal).where(Goal.user_id == user.id))
        user_goals = goals.scalars().all()

        active_parts = []
        for goal in user_goals:
            tasks = await db.execute(
                select(Task).where(Task.goal_id == goal.id).order_by(Task.order_index)
            )
            for task in tasks.scalars().all():
                parts = await db.execute(
                    select(Part).where(Part.task_id == task.id, Part.status == "active")
                )
                for part in parts.scalars().all():
                    active_parts.append(part)

    if not active_parts:
        await update.message.reply_text(
            "📭 No active parts available. Set a goal on the Dashboard first."
        )
        return

    keyboard = [
        [InlineKeyboardButton(f"⚡ {p.title}", callback_data=f"startquiz_{p.id}")]
        for p in active_parts[:5]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(
        "🎯 *Sudden Death Quiz*\n\nSelect a topic:",
        reply_markup=reply_markup,
        parse_mode="Markdown",
    )


async def handle_quiz_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle inline button press to start a quiz."""
    query = update.callback_query
    await query.answer()

    data = query.data
    if not data.startswith("startquiz_"):
        return

    part_id = data.replace("startquiz_", "")
    chat_id = query.message.chat_id

    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.telegram_chat_id == chat_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            await query.edit_message_text("❌ Account not linked.")
            return

        part_result = await db.execute(select(Part).where(Part.id == part_id))
        part = part_result.scalar_one_or_none()
        if not part:
            await query.edit_message_text("❌ Part not found.")
            return

        # Generate random MCQs
        mcqs = await generate_mcqs(part.title, count=5)

        # Store quiz data in bot's memory (stateless relative to DB)
        context.user_data["correct_indices"] = [q.get("correct_index") for q in mcqs]
        context.user_data["mcqs"] = mcqs  # Store for reference during scoring
        context.user_data["part_id"] = str(part.id)
        context.user_data["current_q"] = 0
        context.user_data["user_answers"] = []

        # Send first question
        await send_question(query.message, context, mcqs, 0)


async def send_question(message, context, mcqs, idx):
    """Send a single MCQ question with inline buttons."""
    q = mcqs[idx]
    keyboard = [
        [InlineKeyboardButton(f"{chr(65+i)}. {opt}", callback_data=f"answer_{idx}_{i}")]
        for i, opt in enumerate(q["options"])
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await message.reply_text(
        f"*Q{idx+1}/{len(mcqs)}*\n\n{q['question']}",
        reply_markup=reply_markup,
        parse_mode="Markdown",
    )


async def handle_answer(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle answer selection."""
    query = update.callback_query
    await query.answer()

    data = query.data
    if not data.startswith("answer_"):
        return

    parts = data.split("_")
    q_idx = int(parts[1])
    answer_idx = int(parts[2])

    user_answers = context.user_data.get("user_answers", [])
    user_answers.append(answer_idx)
    context.user_data["user_answers"] = user_answers

    correct_indices = context.user_data.get("correct_indices")
    mcqs = context.user_data.get("mcqs")
    part_id = context.user_data.get("part_id")
    
    if not mcqs or correct_indices is None:
        await query.edit_message_text("❌ Quiz session lost or expired. Start a new one with /quiz.")
        return

    next_idx = q_idx + 1

    if next_idx < len(mcqs):
        # Send next question
        await query.edit_message_text(f"✅ Answer recorded for Q{q_idx+1}.")
        await send_question(query.message, context, mcqs, next_idx)
    else:
        # All answered — score it
        correct = sum(
            1 for i, correct_idx in enumerate(correct_indices)
            if user_answers[i] == correct_idx
        )
        score = (correct / len(mcqs)) * 100
        is_passed = score >= 80

        chat_id = query.message.chat_id

        async with async_session() as db:
            # Get user
            user_result = await db.execute(
                select(User).where(User.telegram_chat_id == chat_id)
            )
            user = user_result.scalar_one_or_none()

            from models import QuizResult
            from datetime import datetime, timezone
            
            should_increment = False
            if is_passed and user:
                recent_passed_result = await db.execute(
                    select(QuizResult)
                    .where(QuizResult.user_id == user.id)
                    .where(QuizResult.is_passed == True)
                    .order_by(QuizResult.completed_at.desc())
                    .limit(1)
                )
                last_passed = recent_passed_result.scalar_one_or_none()
                today = datetime.now(timezone.utc).date()
                
                if not last_passed:
                    should_increment = True
                else:
                    last_date = (last_passed.completed_at.replace(tzinfo=timezone.utc).date() 
                                 if last_passed.completed_at.tzinfo is None 
                                 else last_passed.completed_at.astimezone(timezone.utc).date())
                    if last_date < today:
                        should_increment = True

            qr = QuizResult(
                user_id=user.id,
                part_id=part_id,
                score_percent=score,
                is_passed=is_passed,
            )
            db.add(qr)

            if is_passed and user:
                if should_increment:
                    user.current_streak += 1
                part_r = await db.execute(select(Part).where(Part.id == part_id))
                pt = part_r.scalar_one_or_none()
                if pt:
                    pt.status = "passed"

                    # Find all parts in the same task
                    siblings = await db.execute(
                        select(Part)
                        .where(Part.task_id == pt.task_id)
                        .order_by(Part.order_index)
                    )
                    all_parts = siblings.scalars().all()

                    # Unlock next part
                    found_current = False
                    for p in all_parts:
                        if found_current and p.status == "locked":
                            p.status = "active"
                            break
                        if p.id == pt.id:
                            found_current = True

                    # Check if all parts in task are passed
                    all_passed = all(p.status == "passed" for p in all_parts)
                    if all_passed:
                        task_result = await db.execute(select(Task).where(Task.id == pt.task_id))
                        task = task_result.scalar_one_or_none()
                        if task:
                            task.status = "passed"
                            # Unlock next task
                            next_task = await db.execute(
                                select(Task)
                                .where(Task.goal_id == task.goal_id, Task.order_index == task.order_index + 1)
                            )
                            nt = next_task.scalar_one_or_none()
                            if nt:
                                nt.status = "active"
                                # Unlock first part of next task
                                first_part = await db.execute(
                                    select(Part).where(Part.task_id == nt.id).order_by(Part.order_index).limit(1)
                                )
                                fp = first_part.scalar_one_or_none()
                                if fp:
                                    fp.status = "active"

            await db.commit()

            if is_passed:
                await query.edit_message_text(
                    f"🏆 *MASTERY VERIFIED*\n\n"
                    f"Score: *{score:.0f}%* ({correct}/{len(mcqs)})\n"
                    f"Streak: *{user.current_streak} days*\n\n"
                    f"Next part unlocked. Use /quiz to keep going!",
                    parse_mode="Markdown",
                )
            else:
                await query.edit_message_text(
                    f"❌ *VERIFICATION FAILED*\n\n"
                    f"Score: *{score:.0f}%* ({correct}/{len(mcqs)})\n"
                    f"Required: ≥80%\n\n"
                    f"Use /quiz to try again.",
                    parse_mode="Markdown",
                )

            # Clear context
            context.user_data.clear()


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /status — show user progress."""
    chat_id = update.effective_chat.id

    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.telegram_chat_id == chat_id)
        )
        user = result.scalar_one_or_none()

    if not user:
        await update.message.reply_text("❌ Account not linked. Use /start for instructions.")
        return

    await update.message.reply_text(
        f"📊 *Exiom Status*\n\n"
        f"🔥 Streak: *{user.current_streak} days*\n"
        f"🕐 Schedule: {', '.join(user.study_schedule or [])}\n"
        f"🌐 Timezone: {user.timezone}",
        parse_mode="Markdown",
    )


async def schedule_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /schedule — show nudge times."""
    chat_id = update.effective_chat.id

    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.telegram_chat_id == chat_id)
        )
        user = result.scalar_one_or_none()

    if not user:
        await update.message.reply_text("❌ Account not linked.")
        return

    schedule = user.study_schedule or ["12:00", "18:00"]
    schedule_text = "\n".join([f"  ⏰ {t}" for t in schedule])
    await update.message.reply_text(
        f"📅 *Your Nudge Schedule*\n\n{schedule_text}\n\n"
        f"Timezone: `{user.timezone}`\n\n"
        f"_Change this on the Dashboard → Settings._",
        parse_mode="Markdown",
    )

async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Log the error and send a message to notify the developer."""
    logger.error(msg="Exception while handling an update:", exc_info=context.error)
    
    # Try to notify the user if possible
    if isinstance(update, Update) and update.effective_message:
        await update.effective_message.reply_text(
            "⚠️ An internal error occurred. Our engineers have been notified."
        )

async def info_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /info command — list available commands."""
    commands_text = (
        "ℹ️ *Exiom AI — Available Commands*\n\n"
        "⚡ /quiz — Start a Sudden Death quiz\n"
        "📊 /status — View your current streak and progress\n"
        "📅 /schedule — View your study and nudge schedule\n"
    )
    await update.message.reply_text(commands_text, parse_mode="Markdown")


async def settz_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/settz <IANA_timezone> — update the user's stored timezone."""
    chat_id = update.effective_chat.id
    args = context.args
    if not args:
        await update.message.reply_text(
            "📍 *Set Your Timezone*\n\nUsage: `/settz Asia/Kolkata`\nExamples: `Asia/Kolkata`, `America/New_York`, `Europe/London`",
            parse_mode="Markdown",
        )
        return

    tz_str = args[0].strip()
    try:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
        ZoneInfo(tz_str)  # validate
    except Exception:
        await update.message.reply_text(
            f"❌ Unknown timezone `{tz_str}`. Use an IANA name like `Asia/Kolkata` or `America/New_York`.",
            parse_mode="Markdown",
        )
        return

    async with async_session() as db:
        result = await db.execute(select(User).where(User.telegram_chat_id == chat_id))
        user = result.scalar_one_or_none()
        if not user:
            await update.message.reply_text("❌ Account not linked. Use /start for instructions.")
            return
        user.timezone = tz_str
        db.add(user)
        await db.commit()

    await update.message.reply_text(
        f"✅ Timezone updated to `{tz_str}`. All future reminders will use this timezone.",
        parse_mode="Markdown",
    )


async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Route free-text Telegram messages through the personal agent."""
    chat_id = update.effective_chat.id
    text = (update.message.text or "").strip()
    if not text:
        return

    async with async_session() as db:
        result = await db.execute(select(User).where(User.telegram_chat_id == chat_id))
        user = result.scalar_one_or_none()

    if not user:
        await update.message.reply_text(
            "🔗 Account not linked. Use /start to get your Chat ID, then connect in Exiom Dashboard → Settings."
        )
        return

    # Route through personal agent with conversation context
    from services.personal_agent import process_message as process_personal_assistant
    user_history = context.user_data.get("history", [])
    async with async_session() as db:
        # Reload user in fresh session for DB writes
        result = await db.execute(select(User).where(User.id == user.id))
        user = result.scalar_one_or_none()
        agent_res = await process_personal_assistant(user, text, db, created_via="telegram", history=user_history)

    reply_text = agent_res.get("reply", "I'm not sure how to help with that. Try scheduling a task or asking for your agenda!")

    # Update conversation history in user_data
    user_history = context.user_data.setdefault("history", [])
    user_history.append({"role": "user", "content": text})
    user_history.append({"role": "assistant", "content": reply_text})
    context.user_data["history"] = user_history[-6:]

    # Build inline keyboard if a task was scheduled (Undo button)
    reply_markup = None
    task_info = agent_res.get("task")
    action = agent_res.get("action")
    if action == "schedule_task" and task_info and task_info.get("id"):
        keyboard = [
            [
                InlineKeyboardButton("🗑️ Undo", callback_data=f"undo_{task_info['id']}"),
                InlineKeyboardButton("📅 View Calendar", url="https://exiom.live/calendar"),
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(reply_text, parse_mode="Markdown", reply_markup=reply_markup)


async def handle_undo_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle [Undo] button press to cancel a scheduled PersonalTask."""
    query = update.callback_query
    await query.answer()

    data = query.data  # "undo_<task_uuid>"
    task_id = data.replace("undo_", "")
    chat_id = query.message.chat_id

    from models import PersonalTask
    async with async_session() as db:
        user_res = await db.execute(select(User).where(User.telegram_chat_id == chat_id))
        user = user_res.scalar_one_or_none()
        if not user:
            await query.edit_message_text("❌ Account not linked.")
            return

        task_res = await db.execute(
            select(PersonalTask).where(
                PersonalTask.id == task_id,
                PersonalTask.user_id == user.id,
                PersonalTask.status == "active",
            )
        )
        task = task_res.scalar_one_or_none()
        if not task:
            await query.edit_message_text("⚠️ Task not found or already cancelled.")
            return

        task.status = "cancelled"
        db.add(task)
        await db.commit()

    await query.edit_message_text(f"✅ *'{task.title}'* has been cancelled.", parse_mode="Markdown")


def create_bot_app() -> Application:
    """Create and configure the Telegram bot application."""
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("quiz", quiz_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(CommandHandler("schedule", schedule_command))
    app.add_handler(CommandHandler("info", info_command))
    app.add_handler(CommandHandler("settz", settz_command))
    app.add_handler(CallbackQueryHandler(handle_quiz_start, pattern=r"^startquiz_"))
    app.add_handler(CallbackQueryHandler(handle_answer, pattern=r"^answer_"))
    app.add_handler(CallbackQueryHandler(handle_undo_callback, pattern=r"^undo_"))
    # Text messages route through the personal assistant (MUST come last)
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message))

    # Add error handler
    app.add_error_handler(error_handler)

    return app
