"""
SSE Streaming Router for Goal Agent Pipeline.

Streams real-time stage progression, confidence scores, and final roadmap:
  data: {"event": "progress", "stage": "research", "stage_index": 3, "progress": 0.5}
  ...
  data: {"event": "complete", "state": {...}, "roadmap": [...], "confidence_score": 0.85}
"""

import asyncio
import json
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from auth import get_current_user
from models import User
from services.goal_agent import run_goal_agent
from services.checkpoint import get_checkpoint_store

logger = logging.getLogger("edxiom.goal_stream")

router = APIRouter(prefix="/goals", tags=["Goal Agent Streaming"])


async def _stream_pipeline(
    raw_goal: str,
    user_id: str,
    clarification_reply: Optional[str] = None,
    preferred_language: Optional[str] = None,
    target_months: Optional[int] = None,
    daily_hours: Optional[float] = None,
):
    """Async generator yielding Server-Sent Events."""
    run_id = str(uuid.uuid4())
    progress_queue: asyncio.Queue = asyncio.Queue()

    # Launch pipeline as background task with progress queue
    task = asyncio.create_task(
        run_goal_agent(
            user_id=user_id,
            raw_goal=raw_goal,
            clarification_reply=clarification_reply,
            preferred_language=preferred_language,
            target_months=target_months,
            daily_hours=daily_hours,
            run_id=run_id,
            progress_queue=progress_queue,
        )
    )

    # Initial connection ping
    yield f"data: {json.dumps({'event': 'started', 'run_id': run_id, 'raw_goal': raw_goal})}\n\n"

    while not task.done() or not progress_queue.empty():
        try:
            # Wait for event from pipeline or timeout to check task status
            event = await asyncio.wait_for(progress_queue.get(), timeout=1.0)
            yield f"data: {json.dumps({'event': 'progress', **event})}\n\n"
        except asyncio.TimeoutError:
            # Heartbeat ping to prevent connection timeout
            yield ": keepalive\n\n"
            continue
        except Exception as e:
            logger.debug(f"Stream error reading queue: {e}")
            break

    try:
        final_state = await task
        syllabus = final_state.get("verified_syllabus") or final_state.get("draft_syllabus") or []
        yield f"data: {json.dumps({'event': 'complete', 'run_id': run_id, 'confidence_score': final_state.get('confidence_score', 0.0), 'degraded': final_state.get('degraded', False), 'detected_entity': final_state.get('detected_entity'), 'needs_clarification': final_state.get('needs_clarification', False), 'clarification_question': final_state.get('clarification_question'), 'roadmap': syllabus})}\n\n"
    except Exception as e:
        logger.error(f"Stream pipeline failed: {e}", exc_info=True)
        yield f"data: {json.dumps({'event': 'error', 'run_id': run_id, 'error': str(e)})}\n\n"


@router.get("/stream")
async def stream_goal_progress(
    goal: str = Query(..., description="Target learning goal or exam title"),
    clarification: Optional[str] = Query(None, description="Optional user clarification reply"),
    language: Optional[str] = Query(None, description="Preferred language (English, Hindi, Hinglish)"),
    months: Optional[int] = Query(None, description="Target timeline in months"),
    hours: Optional[float] = Query(None, description="Daily study hours"),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Server-Sent Events endpoint to stream the 8-stage AI goal agent execution in real-time.
    Supports browser EventSource or fetch with readable stream.
    """
    user_id = str(current_user.id) if current_user else "anonymous"

    return StreamingResponse(
        _stream_pipeline(
            raw_goal=goal,
            user_id=user_id,
            clarification_reply=clarification,
            preferred_language=language,
            target_months=months,
            daily_hours=hours,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/checkpoint/{run_id}")
async def get_goal_checkpoint(
    run_id: str,
    current_user: Optional[User] = Depends(get_current_user),
):
    """Retrieve checkpointed state for a specific run_id (resumable inspection)."""
    store = get_checkpoint_store()
    checkpoint = await store.load(run_id)
    if not checkpoint:
        return {"found": False, "run_id": run_id, "state": None}
    return {"found": True, "run_id": run_id, "stage": checkpoint.get("stage"), "state": checkpoint.get("state")}
