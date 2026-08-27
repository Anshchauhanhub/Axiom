"""
YouTube search & transcript service — resilient 5-layer cascade.

Layer 0 : Disk cache  — positive 7d / negative 24h
Layer 1 : YouTube Data API v3  — official, 10k free units/day, instant
Layer 2 : yt-dlp  — reverse-engineers YouTube's internal mobile API,
           bypasses bot-detection that blocks raw httpx from cloud IPs.
Layer 3 : duckduckgo-search library — uses DDG's internal VQD JSON API,
           not raw HTML scraping, survives Render IPs.
Layer 4 : Invidious round-robin — open-source YT proxies, clean JSON API.
Layer 5 : Graceful exit — return None, content renders text-only.
"""

import os
import json
import hashlib
import time
import asyncio
import logging
import subprocess
import httpx
import re
from pathlib import Path
from typing import Optional, List, Dict

logger = logging.getLogger("edxiom.youtube")

# ── Config ─────────────────────────────────────────────────────────────

TRANSCRIPT_API_URL = os.getenv("TRANSCRIPT_API_URL", "https://transcriptapi.com/api")
TRANSCRIPT_API_KEY = os.getenv("TRANSCRIPT_API_KEY", "")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")   # YouTube Data API v3

CACHE_TTL_POSITIVE = int(os.getenv("CACHE_TTL", 86400)) * 7   # 7 days for hits
CACHE_TTL_NEGATIVE = int(os.getenv("CACHE_TTL", 86400))        # 24h  for misses

# Use /tmp on Render (ephemeral but fine — warms up quickly) or a local dir
_CACHE_DIR = Path(os.getenv("YT_CACHE_DIR", "/tmp/axiom_yt_cache"))
_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Invidious public instances — round-robin through all before giving up
_INVIDIOUS_INSTANCES = [
    "https://inv.nadeko.net",
    "https://invidious.privacydev.net",
    "https://invidious.nerdvpn.de",
    "https://invidious.lunar.icu",
    "https://iv.datura.network",
]

# ── Disk Cache ─────────────────────────────────────────────────────────

def _cache_key(query: str) -> str:
    return hashlib.md5(query.lower().strip().encode()).hexdigest()


def _cache_path(key: str) -> Path:
    return _CACHE_DIR / f"{key}.json"


def _read_cache(query: str) -> Optional[str]:
    """Return cached video_id (str), "" for negative cache, or None on miss/expired."""
    key = _cache_key(query)
    path = _cache_path(key)
    try:
        if not path.exists():
            return None
        data = json.loads(path.read_text())
        video_id = data.get("video_id", None)   # "" = negative cache
        stored_at = data.get("stored_at", 0)
        ttl = CACHE_TTL_NEGATIVE if video_id == "" else CACHE_TTL_POSITIVE
        if time.time() - stored_at > ttl:
            path.unlink(missing_ok=True)
            return None
        return video_id
    except Exception:
        return None


def _write_cache(query: str, video_id: Optional[str]) -> None:
    """Write video_id to cache. Pass None or "" for a negative entry."""
    key = _cache_key(query)
    try:
        _cache_path(key).write_text(json.dumps({
            "video_id": video_id if video_id else "",
            "query": query,
            "stored_at": time.time(),
        }))
    except Exception as e:
        logger.debug(f"Cache write failed (non-fatal): {e}")


# ── Layer 1: YouTube Data API v3 ──────────────────────────────────────

async def _search_via_youtube_api(query: str) -> Optional[str]:
    """
    Query YouTube Data API v3 /search endpoint.
    10,000 free units/day (each search = 100 units → 100 free searches/day).
    Returns the best video_id for the query.
    Only active when YOUTUBE_API_KEY is set in the environment.
    """
    if not YOUTUBE_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={
                    "part": "id",
                    "q": query,
                    "type": "video",
                    "videoDuration": "medium",   # 4–20 min — skip shorts & multi-hour lectures
                    "maxResults": 5,
                    "relevanceLanguage": "en",
                    "safeSearch": "moderate",
                    "key": YOUTUBE_API_KEY,
                },
            )
            if resp.status_code == 200:
                items = resp.json().get("items", [])
                for item in items:
                    vid = item.get("id", {}).get("videoId", "")
                    if vid and len(vid) == 11:
                        logger.info(f"✅ YouTube Data API found video: {vid}")
                        return vid
            elif resp.status_code == 403:
                data = resp.json()
                reason = data.get("error", {}).get("errors", [{}])[0].get("reason", "")
                if reason == "quotaExceeded":
                    logger.warning("⚠️  YouTube Data API quota exceeded — falling back")
                else:
                    logger.warning(f"YouTube Data API 403: {reason}")
            else:
                logger.debug(f"YouTube Data API returned HTTP {resp.status_code}")
    except Exception as e:
        logger.warning(f"YouTube Data API error: {e}")
    return None


# ── Layer 2: yt-dlp ────────────────────────────────────────────────────

async def _search_via_ytdlp(query: str) -> Optional[str]:
    """
    Use yt-dlp to search YouTube via its internal mobile API.
    yt-dlp uses Android client headers, bypassing HTML bot walls.
    """
    try:
        cmd = [
            "yt-dlp",
            "--no-playlist",
            "--get-id",
            "--match-filter", "duration > 60",   # skip shorts < 1 min
            "--no-warnings",
            "--quiet",
            f"ytsearch1:{query}",
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=20.0)
        except asyncio.TimeoutError:
            proc.kill()
            logger.warning("yt-dlp search timed out")
            return None

        video_id = stdout.decode().strip()
        if video_id and len(video_id) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', video_id):
            logger.info(f"✅ yt-dlp found video: {video_id}")
            return video_id

        logger.debug(f"yt-dlp returned no valid ID for '{query}'. stderr: {stderr.decode()[:200]}")
    except FileNotFoundError:
        logger.warning("yt-dlp not installed — skipping Layer 1")
    except Exception as e:
        logger.warning(f"yt-dlp search error: {e}")
    return None


# ── Layer 2: duckduckgo-search library ────────────────────────────────

async def _search_via_ddg(query: str) -> Optional[str]:
    """
    Use the duckduckgo-search library's videos() method.
    It uses DDG's internal VQD JSON API — not raw HTML scraping.
    """
    try:
        from duckduckgo_search import DDGS
        loop = asyncio.get_event_loop()

        def _ddg_search():
            with DDGS() as ddg:
                results = list(ddg.videos(
                    f"site:youtube.com {query}",
                    max_results=5,
                ))
            return results

        results = await loop.run_in_executor(None, _ddg_search)
        for r in results:
            url = r.get("content", "") or r.get("url", "")
            match = re.search(r'[?&]v=([a-zA-Z0-9_-]{11})', url)
            if match:
                video_id = match.group(1)
                logger.info(f"✅ DDG library found video: {video_id}")
                return video_id
    except ImportError:
        logger.warning("duckduckgo-search not installed — skipping Layer 2")
    except Exception as e:
        logger.warning(f"DDG library search error: {e}")
    return None


# ── Layer 3: Invidious round-robin ────────────────────────────────────

async def _search_via_invidious(query: str) -> Optional[str]:
    """
    Query public Invidious instances (open-source YT front-ends).
    They proxy YouTube and expose a clean JSON API — their servers
    talk to YT so ours don't have to.
    """
    for instance in _INVIDIOUS_INSTANCES:
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(
                    f"{instance}/api/v1/search",
                    params={"q": query, "type": "video", "page": 1},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data:
                        vid = item.get("videoId", "")
                        if vid and len(vid) == 11:
                            logger.info(f"✅ Invidious ({instance}) found video: {vid}")
                            return vid
        except Exception as e:
            logger.debug(f"Invidious instance {instance} failed: {e}")
    logger.warning("All Invidious instances exhausted")
    return None


# ── Public API: search_youtube_video_id ───────────────────────────────

async def search_youtube_video_id(query: str) -> Optional[str]:
    """
    Resilient 4-layer YouTube video search.
    Returns an 11-char video_id, or None if all layers fail.
    Results are cached (positive 7d / negative 24h).
    """
    # Layer 0: Cache check
    cached = _read_cache(query)
    if cached is not None:
        if cached == "":
            logger.debug(f"Cache: negative hit for '{query}'")
            return None
        logger.info(f"🗂️  Cache hit for '{query}': {cached}")
        return cached

    logger.info(f"🔍 YouTube search (all layers) for: '{query}'")

    # Layer 1: YouTube Data API v3 (fastest, official)
    video_id = await _search_via_youtube_api(query)

    # Layer 2: yt-dlp (mobile API emulation)
    if not video_id:
        video_id = await _search_via_ytdlp(query)

    # Layer 3: DDG library (VQD JSON API)
    if not video_id:
        video_id = await _search_via_ddg(query)

    # Layer 4: Invidious round-robin
    if not video_id:
        video_id = await _search_via_invidious(query)

    # Cache result (positive or negative)
    _write_cache(query, video_id)

    if video_id:
        logger.info(f"🎬 Final result for '{query}': {video_id}")
    else:
        logger.warning(f"⚠️  All layers failed for '{query}' — rendering text-only")

    return video_id


# ── Legacy compat: search_transcript_playlists ───────────────────────

async def search_transcript_playlists(query: str, limit: int = 5) -> List[Dict]:
    """
    Legacy entry-point used by services/search.py.
    Now backed by the resilient cascade instead of HTML scraping.
    Returns a list of video dicts compatible with the old format.
    """
    logger.info(f"🎥 search_transcript_playlists (cascade) for: '{query}'")

    # First try TranscriptAPI if configured
    if TRANSCRIPT_API_KEY:
        headers = {
            "User-Agent": "AxiomAI-Agent/1.0",
            "Accept": "application/json",
            "Authorization": f"Bearer {TRANSCRIPT_API_KEY}",
        }
        try:
            async with httpx.AsyncClient(headers=headers, timeout=12.0) as client:
                resp = await client.get(
                    f"{TRANSCRIPT_API_URL.rstrip('/')}/search",
                    params={"q": query, "limit": limit}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results") or data.get("videos") or []
                    formatted = []
                    for item in results:
                        vid = item.get("video_id") or item.get("id")
                        if vid:
                            formatted.append({
                                "video_id": vid,
                                "title": item.get("title", f"Tutorial on {query}"),
                                "url": item.get("url") or f"https://www.youtube.com/watch?v={vid}",
                                "satisfaction_score": float(item.get("satisfaction_score") or 9.0),
                            })
                    if formatted:
                        logger.info(f"✅ TranscriptAPI returned {len(formatted)} videos")
                        return formatted[:limit]
        except Exception as e:
            logger.warning(f"TranscriptAPI search failed ({e}) — falling back to cascade")

    # Cascade fallback: fetch a single best video_id per query
    video_id = await search_youtube_video_id(query)
    if video_id:
        return [{
            "video_id": video_id,
            "title": f"Tutorial on {query}",
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "satisfaction_score": 8.5,
        }]
    return []


# ── Transcript fetching (unchanged) ───────────────────────────────────

async def get_video_transcript(video_id: str) -> Optional[str]:
    """
    Fetches raw transcript text for a YouTube video via TranscriptAPI /transcript endpoint.
    """
    if not video_id:
        return None

    logger.info(f"🎥 Fetching TranscriptAPI transcript for video ID: {video_id}")
    headers = {
        "User-Agent": "AxiomAI-Agent/1.0",
        "Accept": "application/json",
    }
    if TRANSCRIPT_API_KEY:
        headers["Authorization"] = f"Bearer {TRANSCRIPT_API_KEY}"

    try:
        async with httpx.AsyncClient(headers=headers, timeout=12.0) as client:
            resp = await client.get(
                f"{TRANSCRIPT_API_URL.rstrip('/')}/transcript",
                params={"video_id": video_id}
            )
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, str):
                    return data
                text_content = data.get("transcript") or data.get("text")
                if isinstance(text_content, list):
                    text_content = " ".join([
                        t.get("text", "") if isinstance(t, dict) else str(t)
                        for t in text_content
                    ])
                if text_content:
                    logger.info(f"✅ Fetched transcript ({len(text_content)} chars) for {video_id}")
                    return str(text_content)
    except Exception as e:
        logger.warning(f"TranscriptAPI transcript fetch failed for {video_id}: {e}")

    return None


async def fetch_concurrent_transcripts(video_ids: List[str]) -> Dict[str, Optional[str]]:
    """Concurrently fetches raw transcripts for multiple video_ids."""
    logger.info(f"🚀 Concurrently fetching transcripts for {len(video_ids)} videos...")
    tasks = [get_video_transcript(vid) for vid in video_ids]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    transcript_map = {}
    for vid, res in zip(video_ids, results):
        if isinstance(res, Exception) or res is None:
            transcript_map[vid] = None
        else:
            transcript_map[vid] = res
    return transcript_map


# ── Playlist scraping (unchanged — only used for YouTube playlist import) ──

async def get_playlist_data(url: str):
    """
    Scrapes a public YouTube playlist page to extract playlist title and video titles.
    This function is only called when a user explicitly submits a YouTube playlist URL
    (not for video search), so occasional blocking on cloud IPs is acceptable here.
    """
    import json as _json
    logger.info(f"🎥 Extracting data from playlist: {url}")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=15.0) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
            html = response.text

            json_match = re.search(r'ytInitialData\s*=\s*(\{.*?\});', html)
            data = {}
            if json_match:
                try:
                    data = _json.loads(json_match.group(1))
                except Exception as e:
                    logger.warning(f"Failed to parse ytInitialData JSON: {e}")

            playlist_title = "YouTube Learning Path"
            try:
                if "metadata" in data and "playlistMetadataRenderer" in data["metadata"]:
                    playlist_title = data["metadata"]["playlistMetadataRenderer"]["title"]
            except Exception:
                pass

            if playlist_title == "YouTube Learning Path":
                title_match = re.search(r'<title>(.*?) - YouTube</title>', html)
                if title_match:
                    playlist_title = title_match.group(1)

            videos = []

            def find_titles_recursive(obj, current_depth=0, max_depth=30):
                if current_depth > max_depth:
                    return
                if isinstance(obj, dict):
                    if "playlistVideoRenderer" in obj:
                        try:
                            title = obj["playlistVideoRenderer"]["title"]["runs"][0]["text"]
                            video_id = obj["playlistVideoRenderer"].get("videoId")
                            if title and video_id:
                                videos.append({"title": title, "video_id": video_id})
                        except Exception:
                            pass
                    elif "lockupViewModel" in obj:
                        try:
                            title = obj["lockupViewModel"]["metadata"]["lockupMetadataViewModel"]["title"]["content"]
                            video_id = None
                            endpoint = obj["lockupViewModel"].get("navigationEndpoint", {})
                            if "watchEndpoint" in endpoint:
                                video_id = endpoint["watchEndpoint"].get("videoId")
                            if not video_id:
                                video_id = obj["lockupViewModel"].get("contentId")
                            if title and video_id:
                                videos.append({"title": title, "video_id": video_id})
                        except Exception:
                            pass
                    else:
                        for k, v in obj.items():
                            find_titles_recursive(v, current_depth + 1, max_depth)
                elif isinstance(obj, list):
                    for item in obj:
                        find_titles_recursive(item, current_depth + 1, max_depth)

            if data:
                find_titles_recursive(data)

            if not videos:
                video_matches = re.findall(r'\"title\":\{\"runs\":\[\{\"text\":\"([^\"]*)\"', html)
                video_ids = re.findall(r'\"videoId\":\"([^\"]*)\"', html)
                if video_matches:
                    for idx, title in enumerate(video_matches):
                        vid = video_ids[idx] if idx < len(video_ids) else "dQw4w9WgXcQ"
                        videos.append({"title": title, "video_id": vid})

            seen = set()
            unique_videos = []
            for v in videos:
                t = v["title"]
                t_clean = t.encode('utf-8').decode('unicode-escape', errors='ignore') if '\\u' in t else t
                if t_clean not in seen and len(t_clean) > 3 and t_clean not in ["Play all", "Shuffle", "Mix"]:
                    unique_videos.append({"title": t_clean, "video_id": v["video_id"]})
                    seen.add(t_clean)

            videos = unique_videos
            if not videos:
                return None

            return {"title": playlist_title, "videos": videos}

        except Exception as e:
            logger.error(f"YouTube scraper error: {e}")
            return None
