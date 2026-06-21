import logging
import httpx
import re
import urllib.parse
from services.groq import generate_documentation
from services.search import search_internet

logger = logging.getLogger("edxiom.synthesis")

async def synthesize_part_content(part_title: str) -> str:
    """
    Perform web research and synthesize complex documentation for a given part title.
    Integrates an automatically matching YouTube tutorial video.
    """
    # 1. Parse clean title and optional video ID
    if " || " in part_title:
        clean_title, video_id = part_title.split(" || ", 1)
        clean_title = clean_title.strip()
        video_id = video_id.strip()
    else:
        clean_title, video_id = part_title.strip(), None

    logger.info(f"🚀 Initializing Generation for: {clean_title}")
    
    # 2. If no video_id exists (e.g. chat-based roadmap), fetch one from YouTube search
    if not video_id:
        try:
            logger.info(f"🔍 Searching YouTube for highly relevant video: '{clean_title}'")
            q = urllib.parse.quote(clean_title + " tutorial")
            url = f"https://www.youtube.com/results?search_query={q}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=10.0) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    matches = re.findall(r'/watch\?v=([a-zA-Z0-9_-]{11})', res.text)
                    if matches:
                        video_id = matches[0]
                        logger.info(f"✅ Found YouTube video: {video_id}")
        except Exception as e:
            logger.warning(f"Failed to fetch YouTube search video ID: {e}")

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
