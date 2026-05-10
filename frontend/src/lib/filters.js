// Client-side filter applied to /search results before render.
// Backend returns canonical JP condition strings; UI groups them into
// 5 buckets + an "Unspecified" catch-all.

export const CONDITION_BUCKETS = [
  { id: 'new',          label: 'New',          matches: ['新品', '新品、未使用'] },
  { id: 'near-new',     label: 'Near new',     matches: ['未使用に近い', '未使用'] },
  { id: 'lightly-used', label: 'Lightly used', matches: ['目立った傷や汚れなし', '良好'] },
  { id: 'used',         label: 'Used',         matches: ['やや傷や汚れあり', '中古'] },
  { id: 'heavily-used', label: 'Heavily used', matches: ['傷や汚れあり', '全体的に状態が悪い', '可'] },
  { id: 'unspecified',  label: 'Unspecified',  matches: [] },
];

export function bucketForCondition(condition) {
  if (!condition) return 'unspecified';
  for (const b of CONDITION_BUCKETS) {
    if (b.matches.includes(condition)) return b.id;
  }
  return 'unspecified';
}

// Inverse of jpyToVnd:
//   VND = JPY × rate × (1 + markupPct/100) + weightKg × shipVndPerKg
//   JPY = (VND − weightKg × shipVndPerKg) / (rate × (1 + markupPct/100))
//
// Used to convert VND filter bounds into JPY for comparison against item.price.
export function vndToJpy(vnd, weightKg, cfg) {
  if (!Number.isFinite(vnd) || !cfg) return null;
  const denom = cfg.rate * (1 + cfg.markupPct / 100);
  if (denom <= 0) return null;
  const ship = (weightKg ?? cfg.defaultWeightKg ?? 0) * cfg.shipVndPerKg;
  const jpy = (vnd - ship) / denom;
  // VND below the shipping floor → equivalent JPY is negative;
  // treat as "0 yen" (always passes lower-bound checks but never as upper-bound).
  return jpy;
}

export function applyClientFilters(items, filters, ctx = {}) {
  const { priceMin, priceMax, vndMin, vndMax, conditionBuckets } = filters;
  const { pricing, weightKg } = ctx;

  // Pre-compute JPY-equivalent bounds derived from VND inputs.
  const jpyFromVndMin =
    vndMin != null && Number.isFinite(vndMin) && pricing
      ? vndToJpy(vndMin, weightKg, pricing)
      : null;
  const jpyFromVndMax =
    vndMax != null && Number.isFinite(vndMax) && pricing
      ? vndToJpy(vndMax, weightKg, pricing)
      : null;

  return items.filter((it) => {
    const p = it.price;
    if (p != null) {
      if (priceMin != null && Number.isFinite(priceMin) && p < priceMin) return false;
      if (priceMax != null && Number.isFinite(priceMax) && p > priceMax) return false;
      if (jpyFromVndMin != null && p < jpyFromVndMin) return false;
      if (jpyFromVndMax != null && p > jpyFromVndMax) return false;
    }
    if (conditionBuckets && conditionBuckets.length > 0) {
      const bucket = bucketForCondition(it.condition);
      if (!conditionBuckets.includes(bucket)) return false;
    }
    return true;
  });
}
