import { useEffect, useState, useCallback } from 'react';

export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // quota exceeded — silently drop, caller can decide what to do
    }
  }, [key, value]);

  // sync across tabs
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== key) return;
      try {
        setValue(e.newValue == null ? initial : JSON.parse(e.newValue));
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key, initial]);

  const reset = useCallback(() => setValue(initial), [initial]);

  return [value, setValue, reset];
}
