import os
import httpx
import json
import re
import asyncio
import logging
from typing import Optional, List, Dict

logger = logging.getLogger("edxiom.youtube")

TRANSCRIPT_API_URL = os.getenv("TRANSCRIPT_API_URL", "https://transcriptapi.com/api")
TRANSCRIPT_API_KEY = os.getenv("TRANSCRIPT_API_KEY", "")


async def search_transcript_playlists(query: str, limit: int = 5) -> List[Dict]:
    """
    Query TranscriptAPI `/search` endpoint using httpx to find highest-rated syllabus playlists/videos.
    Returns a list of video objects with video_id, title, url, satisfaction_score, and view counts.
    """
    logger.info(f"🎥 Querying TranscriptAPI /search for: '{query}'")
    headers = {
        "User-Agent": "AxiomAI-Agent/1.0",
        "Accept": "application/json",
    }
    if TRANSCRIPT_API_KEY:
        headers["Authorization"] = f"Bearer {TRANSCRIPT_API_KEY}"

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
                    title = item.get("title", "Syllabus Video")
                    url = item.get("url") or f"https://www.youtube.com/watch?v={vid}"
                    score = float(item.get("satisfaction_score") or item.get("score") or 9.0)
                    if vid:
                        formatted.append({
                            "video_id": vid,
                            "title": title,
                            "url": url,
                            "satisfaction_score": score
                        })
                logger.info(f"✅ Found {len(formatted)} videos via TranscriptAPI search.")
                return formatted
    except Exception as e:
        logger.warning(f"TranscriptAPI search failed or unconfigured ({e}). Falling back to YouTube web search.")

    # Fallback to direct YouTube search parsing via httpx
    return await _fallback_youtube_search(query, limit=limit)


async def _fallback_youtube_search(query: str, limit: int = 5) -> List[Dict]:
    """Fallback youtube search using httpx html parsing and DuckDuckGo search."""
    video_ids = []
    titles = []

    try:
        q_quoted = httpx.URL(f"https://www.youtube.com/results?search_query={query}")
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        }
        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=10.0) as client:
            res = await client.get(str(q_quoted))
            if res.status_code == 200:
                html_chunk = res.text[:250000]
                video_ids = re.findall(
                    r'(?:/watch\?v=|"videoId":\s*"|watchEndpoint":\s*{\s*"videoId":\s*")([a-zA-Z0-9_-]{11})',
                    html_chunk
                )
                titles = re.findall(r'\"title\":\{\"runs\":\[\{\"text\":\"([^\"]*)\"\}', html_chunk)
    except Exception as e:
        logger.warning(f"Fallback YouTube search error: {e}")

    # Fallback to DuckDuckGo search if YouTube search returns no matches
    if not video_ids:
        try:
            ddg_url = "https://html.duckduckgo.com/html/"
            ddg_query = f"site:youtube.com {query}"
            async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}, follow_redirects=True, timeout=10.0) as client:
                resp = await client.post(ddg_url, data={"q": ddg_query})
                if resp.status_code == 200:
                    video_ids = re.findall(r'watch\?v=([a-zA-Z0-9_-]{11})', resp.text[:200000])
        except Exception as e:
            logger.warning(f"DuckDuckGo video fallback search error: {e}")

    unique = []
    seen = set()
    for idx, vid in enumerate(video_ids):
        if len(vid) == 11 and vid not in ("watch_popup", "00000000000") and vid not in seen:
            seen.add(vid)
            title = titles[idx] if idx < len(titles) else f"Tutorial on {query}"
            unique.append({
                "video_id": vid,
                "title": title,
                "url": f"https://www.youtube.com/watch?v={vid}",
                "satisfaction_score": 8.5
            })
            if len(unique) >= limit:
                break
    return unique


async def get_video_transcript(video_id: str) -> Optional[str]:
    """
    Fetches raw transcript text for a YouTube video via TranscriptAPI /transcript endpoint.
    Uses native async httpx.
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
                    text_content = " ".join([t.get("text", "") if isinstance(t, dict) else str(t) for t in text_content])
                if text_content:
                    logger.info(f"✅ Successfully fetched transcript ({len(text_content)} chars) for video: {video_id}")
                    return str(text_content)
    except Exception as e:
        logger.warning(f"TranscriptAPI transcript fetch failed for {video_id}: {e}")

    return None


async def fetch_concurrent_transcripts(video_ids: List[str]) -> Dict[str, Optional[str]]:
    """
    Concurrently fetches raw transcripts for multiple video_ids using asyncio.gather.
    """
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


async def get_playlist_data(url: str):
    """
    Scrapes a public YouTube playlist page to extract playlist title and video titles using httpx.
    """
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
                    data = json.loads(json_match.group(1))
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
                video_matches = re.findall(r'\"title\":\{\"runs\":\[\{\"text\":\"([^\"]*)\"\}', html)
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

            return {
                "title": playlist_title,
                "videos": videos
            }

        except Exception as e:
            logger.error(f"YouTube scraper error: {e}")
            return None
