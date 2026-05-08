import asyncio
from services.youtube import get_playlist_data

async def test_scraper():
    # Test with a public playlist
    url = "https://www.youtube.com/playlist?list=PL4cUxeGkcC9g6mJKs96O196OTy2i6Sw9y" # JavaScript DOM Tutorial
    data = await get_playlist_data(url)
    if data:
        print(f"Playlist Title: {data['title']}")
        print(f"Video Count: {len(data['videos'])}")
        print("First 3 videos:")
        for v in data['videos'][:3]:
            print(f"- {v}")
    else:
        print("Failed to scrape playlist.")

if __name__ == "__main__":
    asyncio.run(test_scraper())
