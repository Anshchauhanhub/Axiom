from ddgs import DDGS
import logging

logger = logging.getLogger("axiom.search")

async def search_internet(query: str, max_results: int = 5) -> str:
    """
    Search the internet using DuckDuckGo (via ddgs) and return a 
    preformatted string of snippets for LLM consumption.
    """
    logger.info(f"🌐 Neural Search: '{query}'")
    try:
        import asyncio
        with DDGS() as ddgs:
            # Run the blocking search in a separate thread so it doesn't freeze FastAPI
            results = await asyncio.to_thread(lambda: list(ddgs.text(query, max_results=max_results)))
            
            if not results:
                return "No relevant search results found."
            
            formatted_results = []
            for r in results:
                formatted_results.append(
                    f"Title: {r.get('title')}\nSource: {r.get('href')}\nContent: {r.get('body')}\n"
                )
            
            return "\n---\n".join(formatted_results)
            
    except Exception as e:
        logger.error(f"❌ Search failed: {e}")
        return f"Error performing search: {str(e)}"
