// Translate display labels to English. Backend keeps source-of-truth in JP
// (so it stays a faithful mirror of the marketplace data) and the UI
// translates at render time.

const CONDITION_EN = {
  '新品、未使用': 'New, unused',
  '未使用に近い': 'Near new',
  '目立った傷や汚れなし': 'No visible wear',
  'やや傷や汚れあり': 'Some wear',
  '傷や汚れあり': 'Visible wear',
  '全体的に状態が悪い': 'Poor condition',
  // Yahoo Auctions free-form condition strings
  '新品': 'New',
  '中古': 'Used',
  '未使用': 'Unused',
  '良好': 'Good',
  '可': 'Acceptable',
};

export function translateCondition(jp) {
  if (!jp) return null;
  return CONDITION_EN[jp] || jp;
}

// Yahoo timeLeft strings like "残り 1日", "残り 5時間", "残り 12分"
const YAHOO_TIME_PARTS = {
  '残り': 'left',
  '日': 'd',
  '時間': 'h',
  '分': 'm',
  '秒': 's',
};

export function translateTimeLeft(jp) {
  if (!jp) return null;
  // Pattern: "残り <num><unit>" — flip to "<num><unit_en> left"
  const m = jp.match(/残り\s*(\d+)\s*(日|時間|分|秒)/);
  if (m) {
    const unit = YAHOO_TIME_PARTS[m[2]] || m[2];
    return `${m[1]}${unit} left`;
  }
  // Fallback: replace word-by-word
  let out = jp;
  for (const [k, v] of Object.entries(YAHOO_TIME_PARTS)) {
    out = out.replace(k, ' ' + v);
  }
  return out.trim();
}
