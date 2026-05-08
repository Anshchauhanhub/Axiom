import httpx
import re
import json

url = "https://www.youtube.com/playlist?list=PLTDARY42LDV7WGmlzZtY-w9pemyPrKNUZ"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
}

with httpx.Client(headers=headers, follow_redirects=True) as client:
    r = client.get(url)
    html = r.text
    
    json_match = re.search(r'ytInitialData\s*=\s*(\{.*?\});', html)
    if json_match:
        data = json.loads(json_match.group(1))
        
        # Look for playlist videos
        # Path: header.playlistHeaderRenderer.title.simpleText (for playlist title)
        try:
            print("Playlist Title:", data['header']['playlistHeaderRenderer']['title']['simpleText'])
        except:
            print("Playlist Title not found in header")

        # Path for videos
        videos = []
        try:
            # This is a common path for playlist videos
            tabs = data['contents']['twoColumnBrowseResultsRenderer']['tabs']
            contents = tabs[0]['content']['sectionListRenderer']['contents'][0]['itemSectionRenderer']['contents'][0]['playlistVideoListRenderer']['contents']
            for item in contents:
                if 'playlistVideoRenderer' in item:
                    title = item['playlistVideoRenderer']['title']['runs'][0]['text']
                    videos.append(title)
        except Exception as e:
            print("Failed to traverse JSON path:", e)

        if not videos:
             # Fallback: broad search in JSON
             titles = re.findall(r'"title":\{"runs":\[\{"text":"(.*?)"\}\]\},"index"', html)
             print("Broad regex 1 found:", len(titles), "titles")
             if titles:
                 videos = titles
             else:
                 titles = re.findall(r'"title":\{"runs":\[\{"text":"(.*?)"\}\]\},"accessibility"', html)
                 print("Broad regex 2 found:", len(titles), "titles")
                 videos = titles

        print("Total Videos Found:", len(videos))
        for v in videos[:10]:
            print("-", v)
    else:
        print("ytInitialData NOT FOUND")
