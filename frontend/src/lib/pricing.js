// VND = JPY × rate × (1 + markupPct/100) + weightKg × shipVndPerKg
export function jpyToVnd(jpy, weightKg, cfg) {
  if (!Number.isFinite(jpy) || jpy <= 0 || !cfg) return null;
  const base = jpy * cfg.rate;
  const withMarkup = base * (1 + cfg.markupPct / 100);
  const ship = (weightKg ?? cfg.defaultWeightKg ?? 0) * cfg.shipVndPerKg;
  return Math.round(withMarkup + ship);
}

export function formatJpy(n) {
  if (!Number.isFinite(n)) return '—';
  return `¥${n.toLocaleString('ja-JP')}`;
}

export function formatVnd(n) {
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('vi-VN')} đ`;
}
