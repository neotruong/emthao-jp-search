import { useCallback, useEffect, useState } from 'react';
import { getHealth } from '../api/search';

// Polls the backend /health endpoint. status: 'unknown' | 'checking' | 'ok' | 'down'.
// Auto-checks once on mount; expose `check()` so the UI can re-poll on click.
export function useHealth({ autoCheck = true, intervalMs = null } = {}) {
  const [status, setStatus] = useState('unknown');
  const [lastChecked, setLastChecked] = useState(null);
  const [details, setDetails] = useState(null);

  const check = useCallback(async () => {
    setStatus('checking');
    try {
      const data = await getHealth();
      setStatus(data?.status === 'ok' ? 'ok' : 'down');
      setDetails(data || null);
    } catch (err) {
      setStatus('down');
      setDetails({ error: err.message });
    } finally {
      setLastChecked(Date.now());
    }
  }, []);

  useEffect(() => {
    if (!autoCheck) return undefined;
    check();
    if (!intervalMs) return undefined;
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [autoCheck, intervalMs, check]);

  return { status, lastChecked, details, check };
}
