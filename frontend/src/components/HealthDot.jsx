function timeAgo(ts) {
  if (!ts) return null;
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const LABEL = {
  ok: 'OK',
  down: 'Down',
  checking: 'Checking…',
  unknown: '?',
};

export function HealthDot({ status, lastChecked, details, onClick }) {
  const cls = `health-dot health-${status}`;
  const tipParts = [`Backend: ${LABEL[status]}`];
  const ts = timeAgo(lastChecked);
  if (ts) tipParts.push(`checked ${ts}`);
  if (details?.browserConnected != null) {
    tipParts.push(`browser: ${details.browserConnected ? '✓' : '✗'}`);
  }
  if (details?.cacheEntries != null) {
    tipParts.push(`cache: ${details.cacheEntries}`);
  }
  if (details?.error) tipParts.push(`err: ${details.error}`);
  const tooltip = tipParts.join(' · ');

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      title={`${tooltip} — click to re-check`}
      aria-label={`Backend ${LABEL[status]}, click to re-check`}
    >
      <span className="health-bullet" aria-hidden="true" />
      <span className="health-label">{LABEL[status]}</span>
    </button>
  );
}
