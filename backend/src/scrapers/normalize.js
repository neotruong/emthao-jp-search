function toItem(raw) {
  const item = {
    title: (raw.title || '').trim(),
    price: typeof raw.price === 'number' ? raw.price : null,
    image: raw.image || null,
    url: raw.url || null,
    condition: raw.condition || null,
    source: raw.source,
    currency: 'JPY',
  };
  if (raw.viewCount != null) item.viewCount = raw.viewCount;
  if (raw.bidCount != null) item.bidCount = raw.bidCount;
  if (raw.mode) item.mode = raw.mode;
  if (raw.timeLeft) item.timeLeft = raw.timeLeft;
  if (raw.updatedAt) item.updatedAt = raw.updatedAt;
  return item;
}

module.exports = { toItem };
