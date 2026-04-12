import logging
import httpx
from services.groq import generate_documentation
from services.search import search_internet

logger = logging.getLogger("axiom.synthesis")

async def synthesize_part_content(part_title: str) -> str:
    """
    Perform web research and synthesize complex documentation for a given part title.
    """
    logger.info(f"🚀 Initializing Neural Synthesis for: {part_title}")
    
    # 1. Search Logic
    research_summary = await search_internet(f"detailed study guide and syllabus for {part_title}")
    
    try:
        # 2. Synthesis via Groq
        documentation = await generate_documentation(part_title, research_summary)
        logger.info("✅ Synthesis complete.")
        return documentation
    except Exception as e:
        logger.error(f"❌ Synthesis failed: {e}")
        raise
