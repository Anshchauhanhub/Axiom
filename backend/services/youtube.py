import httpx
import json
import re
import logging

logger = logging.getLogger("axiom.youtube")

async def get_playlist_data(url: str):
    """
    Scrapes a public YouTube playlist page to extract the playlist title and video titles.
    Uses regex to find ytInitialData and parses the JSON.
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
            
            # 1. Extract ytInitialData JSON
            # This regex is more broad to catch variations in spacing or variable names
            json_match = re.search(r'ytInitialData\s*=\s*(\{.*?\});', html)
            data = {}
            if json_match:
                try:
                    data = json.loads(json_match.group(1))
                except:
                    logger.warning("Failed to parse ytInitialData JSON.")

            # 2. Extract Playlist Title
            playlist_title = "YouTube Learning Path"
            # Try to find title in JSON
            try:
                if "metadata" in data and "playlistMetadataRenderer" in data["metadata"]:
                    playlist_title = data["metadata"]["playlistMetadataRenderer"]["title"]
            except:
                pass
            
            # If not in JSON, try regex on HTML
            if playlist_title == "YouTube Learning Path":
                title_match = re.search(r'<title>(.*?) - YouTube</title>', html)
                if title_match:
                    playlist_title = title_match.group(1)

            # 3. Extract Video Titles
            videos = []
            
            def find_titles_recursive(obj):
                """Recursively search for video titles in the nested JSON structure."""
                if isinstance(obj, dict):
                    if "playlistVideoRenderer" in obj:
                        try:
                            title = obj["playlistVideoRenderer"]["title"]["runs"][0]["text"]
                            videos.append(title)
                        except:
                            pass
                    else:
                        for k, v in obj.items():
                            find_titles_recursive(v)
                elif isinstance(obj, list):
                    for item in obj:
                        find_titles_recursive(item)

            if data:
                find_titles_recursive(data)

            if not videos:
                # Try to find all video titles using a broad regex that matches the internal JSON structure in HTML
                # Pattern: "title":{"runs":[{"text":"VIDEO_TITLE"}]}
                # Note: accessibility or index might follow, so we match more loosely
                video_matches = re.findall(r'\"title\":\{\"runs\":\[\{\"text\":\"(.*?)\"\}\]\}', html)
                if video_matches:
                    videos = video_matches
                else:
                    # Secondary attempt with a different pattern (sometimes found in specific scripts)
                    video_matches = re.findall(r'\"title\":\{\"simpleText\":\"(.*?)\"\}', html)
                    if video_matches:
                        videos = video_matches

            # Remove duplicates and filter out nonsense (like 'Play all', 'Shuffle', etc.)
            seen = set()
            unique_videos = []
            for v in videos:
                # Decode unicode escapes if present
                v_clean = v.encode('utf-8').decode('unicode-escape', errors='ignore') if '\\u' in v else v
                # Filter out obvious non-video strings
                if v_clean not in seen and len(v_clean) > 3 and v_clean not in ["Play all", "Shuffle", "Mix"]:
                    unique_videos.append(v_clean)
                    seen.add(v_clean)
            
            videos = unique_videos

            if not videos:
                logger.warning("No videos found in playlist data.")
                return None

            return {
                "title": playlist_title,
                "videos": videos
            }

        except Exception as e:
            logger.error(f"YouTube scraper error: {e}")
            return None
