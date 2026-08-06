from ddgs import DDGS
import logging
import asyncio

logger = logging.getLogger("edxiom.search")

async def search_internet(query: str, max_results: int = 5) -> str:
    """
    Search the internet using DuckDuckGo (via ddgs) and return a 
    preformatted string of snippets for LLM consumption.
    """
    logger.info(f"🌐 Neural Search: '{query}'")
    try:
        with DDGS() as ddgs:
            # Run the blocking search in a separate thread so it doesn't freeze FastAPI
            results = await asyncio.to_thread(lambda: list(ddgs.text(query, max_results=max_results)))
            
            if not results:
                return "No relevant search results found."
            
            formatted_results = []
            for r in results:
                formatted_results.append(
                    f"Title: {r.get('title')}\nSource: {r.get('href')}\nContent: {r.get('body')}\n"
                )
            
            return "\n---\n".join(formatted_results)
            
    except Exception as e:
        logger.error(f"❌ Search failed: {e}")
        return f"Error performing search: {str(e)}"


async def search_entity_deep(entity: str) -> str:
    """
    Deep multi-query search for a named exam/certification entity.
    
    Fires 3 parallel searches to get comprehensive, current information:
    1. Official syllabus and exam pattern
    2. Latest preparation guide and resources
    3. Subject-wise topic list and weightage
    
    Returns a concatenated result string for LLM grounding.
    """
    logger.info(f"🔬 Deep entity search for: '{entity}'")
    
    queries = [
        f"{entity} paper official syllabus detailed topics 2025 2026 2027",
        f"{entity} complete subject wise syllabus topics list with weightage",
        f"{entity} exam pattern marks distribution sections preparation",
    ]
    
    try:
        # Fire all 3 searches in parallel
        tasks = [search_internet(q, max_results=3) for q in queries]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        combined = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning(f"Deep search query {i+1} failed: {result}")
                continue
            combined.append(f"=== Search {i+1}: {queries[i]} ===\n{result}")
        
        full_result = "\n\n".join(combined)
        logger.info(f"✅ Deep search complete: {len(full_result)} chars")
        return full_result
        
    except Exception as e:
        logger.error(f"❌ Deep entity search failed: {e}")
        # Fallback to single search
        return await search_internet(f"{entity} official syllabus exam pattern latest")


async def search_youtube_videos(query: str, max_results: int = 5, language: str = "", preferred_creator: str = "") -> list[dict]:
    """
    Search YouTube for relevant videos and return a list of {title, video_id} dicts.
    Supports filtering by preferred language (Hindi, Hinglish, English) and creator/channel name.
    """
    search_term = query
    if preferred_creator:
        search_term = f"{preferred_creator} {search_term}"
    if language:
        search_term = f"{search_term} in {language}"

    logger.info(f"🎬 Tailored YouTube search: '{search_term}'")
    try:
        with DDGS() as ddgs:
            results = await asyncio.to_thread(
                lambda: list(ddgs.videos(f"{search_term} site:youtube.com", max_results=max_results))
            )
            
            videos = []
            for r in results:
                url = r.get("content", "") or r.get("embed_url", "")
                title = r.get("title", "")
                
                video_id = None
                if "youtube.com/watch?v=" in url:
                    video_id = url.split("v=")[1].split("&")[0]
                elif "youtu.be/" in url:
                    video_id = url.split("youtu.be/")[1].split("?")[0]
                elif "youtube.com/embed/" in url:
                    video_id = url.split("embed/")[1].split("?")[0]
                
                if video_id and title:
                    videos.append({"title": title, "video_id": video_id})
            
            logger.info(f"✅ Found {len(videos)} YouTube videos for: '{search_term}'")
            return videos
            
    except Exception as e:
        logger.warning(f"YouTube search failed (non-fatal): {e}")
        return []


async def search_youtube_playlists(query: str, language: str = "", preferred_creator: str = "", max_results: int = 3) -> list[dict]:
    """
    Search DuckDuckGo for top YouTube playlists and course series matching query, language, and creator.
    """
    search_term = f"{query} full playlist course series"
    if preferred_creator:
        search_term = f"{preferred_creator} {search_term}"
    if language:
        search_term = f"{search_term} {language}"
    
    logger.info(f"📺 YouTube playlist search: '{search_term}'")
    try:
        with DDGS() as ddgs:
            results = await asyncio.to_thread(
                lambda: list(ddgs.text(f"{search_term} site:youtube.com/playlist", max_results=max_results))
            )
            playlists = []
            for r in results:
                playlists.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "snippet": r.get("body", "")
                })
            return playlists
    except Exception as e:
        logger.warning(f"Playlist search failed: {e}")
        return []
