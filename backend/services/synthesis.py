import logging
from services.groq import generate_documentation
from services.search import search_internet

logger = logging.getLogger("edxiom.synthesis")

def _build_famous_creator_query(clean_title: str, goal_title: str = None) -> str:
    """Build a search query targeting single full-course playlists from renowned creators."""
    combined = f"{goal_title or ''} {clean_title}".lower()

    if any(k in combined for k in ["dsa", "data structure", "algorithm", "leetcode", "array", "binary tree", "graph", "dynamic programming"]):
        creator_terms = "Striver takeUforward playlist"
    elif any(k in combined for k in ["gate", "operating system", "dbms", "computer network", "toc", "compiler", "digital logic"]):
        creator_terms = "Gate Smashers Neso Academy playlist"
    elif any(k in combined for k in ["python", "javascript", "react", "java", "c++", "web", "full stack", "node"]):
        creator_terms = "FreeCodeCamp CodeWithHarry Chai aur Code playlist"
    else:
        creator_terms = "full playlist course"

    if goal_title:
        return f"{goal_title} {clean_title} {creator_terms}"
    return f"{clean_title} {creator_terms}"


async def synthesize_part_content(part_title: str, goal_title: str = None) -> str:
    """
    Perform web research and synthesize complex documentation for a given part title.
    Integrates an automatically matching YouTube tutorial video from top educator playlists.
    """
    # 1. Parse clean title and optional video ID
    if " || " in part_title:
        clean_title, video_id = part_title.split(" || ", 1)
        clean_title = clean_title.strip()
        video_id = video_id.strip()
    else:
        clean_title, video_id = part_title.strip(), None

    logger.info(f"🚀 Initializing Generation for: {clean_title} (Goal: {goal_title or 'N/A'})")
    
    # 2. If no video_id exists (e.g. chat-based roadmap), fetch one via resilient cascade
    if not video_id:
        search_query = _build_famous_creator_query(clean_title, goal_title)
        try:
            from services.youtube import search_youtube_video_id
            logger.info(f"🔍 Searching YouTube (cascade) for: '{search_query}'")
            video_id = await search_youtube_video_id(search_query)
            if video_id:
                logger.info(f"✅ Cascade found video: {video_id}")
        except Exception as e:
            logger.warning(f"YouTube cascade search failed: {e}")

    # 3. Search Logic
    research_summary = await search_internet(f"detailed study guide and syllabus for {clean_title}")
    
    # 3.5. Fetch Transcript if video exists
    transcript = None
    if video_id:
        try:
            from services.youtube import get_video_transcript
            transcript = await get_video_transcript(video_id)
        except Exception as e:
            logger.warning(f"Failed to fetch video transcript in synthesis: {e}")

    try:
        # 4. Generation via Groq
        documentation = await generate_documentation(clean_title, research_summary, transcript=transcript)
        
        # 5. Prepend video embed tag if a video was successfully found
        if video_id:
            documentation = f"[youtube:{video_id}]\n\n" + documentation
            
        logger.info("✅ Generation complete.")
        return documentation
    except Exception as e:
        logger.error(f"❌ Generation failed: {e}")
        raise
