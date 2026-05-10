function parsePrice(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/[^\d]/g, '');
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

module.exports = { parsePrice };
