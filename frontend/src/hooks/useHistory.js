import { useCallback } from 'react';
import { usePersistentState } from './usePersistentState';

const KEY = 'emthao.history';
const MAX = 20;

export function useHistory() {
  const [history, setHistory] = usePersistentState(KEY, []);

  const push = useCallback(
    (entry) => {
      if (!entry?.q) return;
      const ts = Date.now();
      setHistory((prev) => {
        const without = prev.filter((h) => h.q !== entry.q);
        return [{ q: entry.q, ts, yahooMode: entry.yahooMode }, ...without].slice(0, MAX);
      });
    },
    [setHistory]
  );

  const remove = useCallback(
    (q) => setHistory((prev) => prev.filter((h) => h.q !== q)),
    [setHistory]
  );

  const clear = useCallback(() => setHistory([]), [setHistory]);

  return { history, push, remove, clear };
}
