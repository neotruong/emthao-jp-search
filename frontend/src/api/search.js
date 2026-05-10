const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

const RETRY_DELAYS_MS = [1000, 2000, 4000];

export async function searchAll({ q, sources, yahooMode, limit, page, nocache, signal }) {
  const params = new URLSearchParams({ q });
  if (sources && sources.length) params.set('sources', sources.join(','));
  if (yahooMode) params.set('yahooMode', yahooMode);
  if (limit) params.set('limit', String(limit));
  if (page && page > 1) params.set('page', String(page));
  if (nocache) params.set('nocache', '1');

  const url = `${BASE}/search?${params.toString()}`;

  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    }
    try {
      const resp = await fetch(url, { signal });
      if (!resp.ok) {
        // 4xx errors are not retried — they're caller's fault
        if (resp.status >= 400 && resp.status < 500) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error || `Request failed: ${resp.status}`);
        }
        throw new Error(`Server error: ${resp.status}`);
      }
      return await resp.json();
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      lastErr = err;
      // 4xx don't retry
      if (err.message.startsWith('Request failed') || err.message.startsWith('Missing') || err.message.startsWith('Query')) {
        throw err;
      }
    }
  }
  throw lastErr || new Error('Search failed after retries');
}

export async function getHealth() {
  const resp = await fetch(`${BASE}/health`);
  return resp.json();
}
