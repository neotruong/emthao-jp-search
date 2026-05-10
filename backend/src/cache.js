const { LRUCache } = require('lru-cache');

const TTL_MS = 7 * 60 * 1000;

const cache = new LRUCache({
  max: 500,
  ttl: TTL_MS,
});

function cacheKey({ q, sources, yahooMode, limit, page }) {
  const sortedSources = [...sources].sort().join(',');
  return `${q}|${sortedSources}|${yahooMode}|${limit}|p${page || 1}`;
}

module.exports = { cache, cacheKey };
