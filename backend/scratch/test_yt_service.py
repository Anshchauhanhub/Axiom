import asyncio
import sys
import os

# Add the project root to sys.path
sys.path.append(os.getcwd())

from backend.services.youtube import get_playlist_data

async def main():
    url = "https://www.youtube.com/playlist?list=PLTDARY42LDV7WGmlzZtY-w9pemyPrKNUZ"
    data = await get_playlist_data(url)
    if data:
        print(f"SUCCESS: Extracted '{data['title']}'")
        print(f"Total Videos: {len(data['videos'])}")
        for v in data['videos'][:5]:
            print(f"- {v}")
    else:
        print("FAILURE: Could not extract data")

if __name__ == "__main__":
    asyncio.run(main())
