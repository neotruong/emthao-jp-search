const { LRUCache } = require('lru-cache');

const TTL_MS = parseInt(process.env.CACHE_TTL_MS, 10) || 7 * 60 * 1000;

const cache = new LRUCache({
  max: 500,
  ttl: TTL_MS,
});

function cacheKey({ q, sources, yahooMode, limit, page }) {
  const sortedSources = [...sources].sort().join(',');
  return `${q}|${sortedSources}|${yahooMode}|${limit}|p${page || 1}`;
}

// Evict every entry for a given query (across all source/yahooMode/limit/page combos).
// Prefix match is safe enough — queries containing a literal '|' would collide, but
// Japanese marketplace queries in practice don't, and the worst case is an extra re-scrape.
function deleteByQuery(q) {
  const prefix = `${q}|`;
  let removed = 0;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      removed++;
    }
  }
  return removed;
}

module.exports = { cache, cacheKey, deleteByQuery };
