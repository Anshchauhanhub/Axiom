import os
import httpx
import json
import logging
import asyncio
import time
from typing import List, Dict, Optional
from urllib.parse import urlparse

logger = logging.getLogger("edxiom.search")

SEARXNG_URL = os.getenv("SEARXNG_URL", "http://localhost:8080")

# ── TTL-based in-memory search cache ─────────────────────────────────
# Key: (query, max_results) -> (result_str, timestamp)
_SEARCH_CACHE: dict[tuple, tuple[str, float]] = {}
_CACHE_TTL_S = float(os.getenv("SEARCH_CACHE_TTL_S", "300"))  # 5 minutes default


def _cache_get(key: tuple) -> Optional[str]:
    entry = _SEARCH_CACHE.get(key)
    if entry is None:
        return None
    result, ts = entry
    if time.time() - ts > _CACHE_TTL_S:
        del _SEARCH_CACHE[key]
        return None
    return result


def _cache_set(key: tuple, value: str) -> None:
    _SEARCH_CACHE[key] = (value, time.time())
    if len(_SEARCH_CACHE) > 500:
        cutoff = time.time() - _CACHE_TTL_S
        expired = [k for k, (_, ts) in _SEARCH_CACHE.items() if ts < cutoff]
        for k in expired:
            del _SEARCH_CACHE[k]


# ── Domain credibility scoring ────────────────────────────────────────

_HIGH_CREDIBILITY_DOMAINS = frozenset([
    ".edu", ".gov", ".ac.in", ".ac.uk", ".org",
    "wikipedia.org", "arxiv.org", "scholar.google",
    "upsc.gov.in", "iitm.ac.in", "iitd.ac.in", "iitb.ac.in",
    "gate.iit", "nta.ac.in", "iimcat.ac.in",
    "coursera.org", "mit.edu", "stanford.edu",
])

_OFFICIAL_KEYWORDS = frozenset([
    "official", "syllabus", "exam", "notification", "pattern",
])


def _credibility_score(url: str) -> int:
    """
    Return a credibility score for a URL (0–4).
    Used by Stage 3 research fan-out to rank and prioritise sources.
    """
    if not url:
        return 0
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        score = 0
        if any(hc in domain for hc in _HIGH_CREDIBILITY_DOMAINS):
            score += 2
        elif domain.endswith((".edu", ".gov", ".ac.in")):
            score += 2
        path = parsed.path.lower()
        if any(kw in path for kw in _OFFICIAL_KEYWORDS):
            score += 1
        if parsed.scheme == "https":
            score += 1
        return min(score, 4)
    except Exception:
        return 0


async def search_internet(query: str, max_results: int = 5) -> str:
    """
    Search the internet using local SearXNG JSON API endpoint (/search?format=json) via httpx.
    Returns a preformatted string of snippets for LLM consumption.
    Cached with TTL to avoid redundant outbound network calls.
    """
    cache_key = (query, max_results)
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.debug(f"⚡ Search cache hit for '{query}'")
        return cached

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
                    output = "\n---\n".join(formatted_results)
                    _cache_set(cache_key, output)
                    return output
    except Exception as e:
        logger.warning(f"SearXNG API search failed or unconfigured at {SEARXNG_URL} ({e}). Falling back to web search.")

    # Fallback to direct httpx search scraper if SearXNG service is unconfigured
    output = await _fallback_httpx_search(query, max_results=max_results)
    _cache_set(cache_key, output)
    return output


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
                html_chunk = resp.text[:200000]
                snippets = re.findall(r'<a class=\"result__snippet[^\"]*\"[^>]*>(.*?)</a>', html_chunk, re.DOTALL)
                titles = re.findall(r'<a class=\"result__url[^\"]*\"[^>]*>(.*?)</a>', html_chunk, re.DOTALL)
                
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
