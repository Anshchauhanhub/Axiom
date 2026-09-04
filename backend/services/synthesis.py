import logging
from services.groq import generate_documentation
from services.search import search_internet

logger = logging.getLogger("edxiom.synthesis")


def _pick_single_creator(clean_title: str, goal_title: str = None) -> str:
    """
    Pick exactly ONE YouTube creator/channel for a given topic and return
    a search query scoped to that creator's catalog.

    Uses the same _CREATOR_MAP registry as goal_agent.py so both
    goal generation and per-part synthesis always agree on the creator.
    Falls back to 'full course tutorial playlist' for unknown topics.
    """
    from services.goal_agent import _CREATOR_MAP  # shared registry, no duplication

    combined = f"{goal_title or ''} {clean_title}".lower()

    for keywords, _display_name, search_suffix in _CREATOR_MAP:
        if any(kw in combined for kw in keywords):
            logger.debug(f"🎨 Synthesis creator: {_display_name} for '{clean_title[:40]}'")
            base = f"{goal_title} {clean_title}" if goal_title else clean_title
            return f"{base} {search_suffix}"

    # Generic fallback — still ONE approach, not a list of creators
    base = f"{goal_title} {clean_title}" if goal_title else clean_title
    return f"{base} full course tutorial playlist"


async def synthesize_part_content(part_title: str, goal_title: str = None) -> str:
    """
    Perform web research and synthesize complex documentation for a given part title.
    Integrates exactly ONE YouTube tutorial video from the best-matched creator's catalog.
    """
    # 1. Parse clean title and optional video ID
    if " || " in part_title:
        clean_title, video_id = part_title.split(" || ", 1)
        clean_title = clean_title.strip()
        video_id = video_id.strip()
    else:
        clean_title, video_id = part_title.strip(), None

    logger.info(f"🚀 Initializing Generation for: {clean_title} (Goal: {goal_title or 'N/A'})")

    # 2. If no video_id pre-attached (chat-based roadmap path), find one
    #    using the single-creator query — same creator the goal agent used.
    if not video_id:
        search_query = _pick_single_creator(clean_title, goal_title)
        try:
            from services.youtube import search_youtube_video_id
            logger.info(f"🔍 Searching YouTube (single-creator) for: '{search_query}'")
            video_id = await search_youtube_video_id(search_query)
            if video_id:
                logger.info(f"✅ Found video: {video_id}")
        except Exception as e:
            logger.warning(f"YouTube search failed: {e}")

    # 3. Web research for the topic
    research_summary = await search_internet(
        f"detailed study guide and syllabus for {clean_title}"
    )

    # 4. Fetch transcript if we have a video
    transcript = None
    if video_id:
        try:
            from services.youtube import get_video_transcript
            transcript = await get_video_transcript(video_id)
        except Exception as e:
            logger.warning(f"Failed to fetch video transcript in synthesis: {e}")

    try:
        # 5. Generate documentation via Groq
        documentation = await generate_documentation(
            clean_title, research_summary, transcript=transcript
        )

        from services.math_utils import clean_latex_math
        documentation = clean_latex_math(documentation)

        # 6. Prepend video embed tag if a video was found
        if video_id:
            documentation = f"[youtube:{video_id}]\n\n" + documentation

        logger.info("✅ Generation complete.")
        return documentation

    except Exception as e:
        logger.error(f"❌ Generation failed: {e}")
        raise
