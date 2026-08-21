import os
import httpx
import json
import logging
import asyncio
from typing import List, Dict

logger = logging.getLogger("edxiom.search")

SEARXNG_URL = os.getenv("SEARXNG_URL", "http://localhost:8080")


async def search_internet(query: str, max_results: int = 5) -> str:
    """
    Search the internet using local SearXNG JSON API endpoint (/search?format=json) via httpx.
    Returns a preformatted string of snippets for LLM consumption.
    """
    logger.info(f"🌐 SearXNG Search: '{query}'")
    headers = {
        "User-Agent": "AxiomAI-Agent/1.0",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:
            resp = await client.get(
                f"{SEARXNG_URL.rstrip('/')}/search",
                params={"q": query, "format": "json"}
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])[:max_results]
                if results:
                    formatted_results = []
                    for r in results:
                        formatted_results.append(
                            f"Title: {r.get('title')}\nSource: {r.get('url')}\nContent: {r.get('content')}\n"
                        )
                    logger.info(f"✅ SearXNG returned {len(results)} results.")
                    return "\n---\n".join(formatted_results)
    except Exception as e:
        logger.warning(f"SearXNG API search failed or unconfigured at {SEARXNG_URL} ({e}). Falling back to web search.")

    # Fallback to direct httpx search scraper if SearXNG service is unconfigured
    return await _fallback_httpx_search(query, max_results=max_results)


async def _fallback_httpx_search(query: str, max_results: int = 5) -> str:
    """Fallback search using direct httpx search query."""
    try:
        url = "https://html.duckduckgo.com/html/"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=10.0) as client:
            resp = await client.post(url, data={"q": query})
            if resp.status_code == 200:
                import re
                snippets = re.findall(r'<a class=\"result__snippet[^\"]*\"[^>]*>(.*?)</a>', resp.text, re.DOTALL)
                titles = re.findall(r'<a class=\"result__url[^\"]*\"[^>]*>(.*?)</a>', resp.text, re.DOTALL)
                
                formatted = []
                for i in range(min(len(snippets), max_results)):
                    clean_snip = re.sub(r'<[^>]+>', '', snippets[i]).strip()
                    clean_title = re.sub(r'<[^>]+>', '', titles[i]).strip() if i < len(titles) else "Search Result"
                    formatted.append(f"Title: {clean_title}\nContent: {clean_snip}\n")
                if formatted:
                    return "\n---\n".join(formatted)
    except Exception as e:
        logger.warning(f"Fallback httpx search error: {e}")

    return "No search results available."


async def search_entity_deep(entity: str) -> str:
    """
    Deep multi-query search for a named exam/certification entity via SearXNG.
    Fires 3 parallel SearXNG queries asynchronously using asyncio.gather.
    """
    logger.info(f"🔬 Deep entity search for: '{entity}'")
    
    queries = [
        f"{entity} paper official syllabus detailed topics 2025 2026",
        f"{entity} complete subject wise syllabus topics list with weightage",
        f"{entity} exam pattern marks distribution sections preparation",
    ]
    
    try:
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
        return await search_internet(f"{entity} official syllabus exam pattern latest")


async def search_youtube_videos(query: str, max_results: int = 5, language: str = "", preferred_creator: str = "") -> List[Dict]:
    """Search YouTube videos using SearXNG JSON API."""
    search_term = query
    if preferred_creator:
        search_term = f"{preferred_creator} {search_term}"
    if language:
        search_term = f"{search_term} in {language}"

    logger.info(f"🎬 YouTube search via SearXNG: '{search_term}'")
    try:
        from services.youtube import search_transcript_playlists
        return await search_transcript_playlists(search_term, limit=max_results)
    except Exception as e:
        logger.warning(f"YouTube search failed: {e}")
        return []


async def search_youtube_playlists(query: str, language: str = "", preferred_creator: str = "", max_results: int = 3) -> List[Dict]:
    """Search YouTube playlists matching query."""
    search_term = f"{query} full playlist course series"
    if preferred_creator:
        search_term = f"{preferred_creator} {search_term}"
    if language:
        search_term = f"{search_term} {language}"
    
    try:
        from services.youtube import search_transcript_playlists
        return await search_transcript_playlists(search_term, limit=max_results)
    except Exception as e:
        logger.warning(f"Playlist search failed: {e}")
        return []
