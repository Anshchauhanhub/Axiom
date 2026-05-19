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
                except Exception as e:
                    logger.warning(f"Failed to parse ytInitialData JSON: {e}")

            # 2. Extract Playlist Title
            playlist_title = "YouTube Learning Path"
            # Try to find title in JSON
            try:
                if "metadata" in data and "playlistMetadataRenderer" in data["metadata"]:
                    playlist_title = data["metadata"]["playlistMetadataRenderer"]["title"]
            except Exception:
                pass
            
            # If not in JSON, try regex on HTML
            if playlist_title == "YouTube Learning Path":
                title_match = re.search(r'<title>(.*?) - YouTube</title>', html)
                if title_match:
                    playlist_title = title_match.group(1)

            # 3. Extract Video Titles and IDs
            videos = []
            
            def find_titles_recursive(obj, current_depth=0, max_depth=30):
                """Recursively search for video titles and IDs in the nested JSON structure."""
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
                # Try to find all video titles and videoIds using regex fallback if JSON is not available
                video_matches = re.findall(r'\"title\":\{\"runs\":\[\{\"text\":\"([^\"]*)\"\}', html)
                video_ids = re.findall(r'\"videoId\":\"([^\"]*)\"', html)
                
                # Zip them up if matching lengths, otherwise fallback to mock IDs
                if video_matches:
                    for idx, title in enumerate(video_matches):
                        vid = video_ids[idx] if idx < len(video_ids) else "dQw4w9WgXcQ"
                        videos.append({"title": title, "video_id": vid})

            # Remove duplicates and filter out nonsense
            seen = set()
            unique_videos = []
            for v in videos:
                t = v["title"]
                # Decode unicode escapes if present
                t_clean = t.encode('utf-8').decode('unicode-escape', errors='ignore') if '\\u' in t else t
                # Filter out obvious non-video strings
                if t_clean not in seen and len(t_clean) > 3 and t_clean not in ["Play all", "Shuffle", "Mix"]:
                    unique_videos.append({"title": t_clean, "video_id": v["video_id"]})
                    seen.add(t_clean)
            
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
