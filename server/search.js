const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

function isConfigured() {
  return !!process.env.TAVILY_API_KEY;
}

/**
 * Search the web via Tavily and return a formatted context string.
 * Returns an empty string if not configured or on error.
 * @param {string} query
 * @param {number} count  number of results to fetch (default 5)
 * @returns {Promise<string>}
 */
async function search(query, count = 5) {
  if (!isConfigured()) return '';

  const res = await fetch(TAVILY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: count,
      include_answer: false
    })
  });

  if (!res.ok) {
    throw new Error(`Tavily search error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const results = data?.results || [];

  if (results.length === 0) {
    return `[Web search for "${query}" returned no results]`;
  }

  const lines = results.map((r, i) =>
    `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.content || '(no description)'}`
  );

  return `[Web search results for: "${query}"]\n${lines.join('\n\n')}`;
}

module.exports = { search, isConfigured };
