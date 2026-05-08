import httpx
import re

url = "https://www.youtube.com/playlist?list=PLTDARY42LDV7WGmlzZtY-w9pemyPrKNUZ"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
}

with httpx.Client(headers=headers, follow_redirects=True) as client:
    r = client.get(url)
    html = r.text
    
    json_match = re.search(r'ytInitialData\s*=\s*(\{.*?\});', html)
    if json_match:
        with open("yt_data.json", "w") as f:
            f.write(json_match.group(1))
        print("ytInitialData saved to yt_data.json")
    else:
        print("ytInitialData NOT FOUND")
