const { logger } = require('../logger');
const { paceDomain } = require('../concurrency');
const { toItem } = require('./normalize');

const SOURCE = 'mercari';
const HOST = 'jp.mercari.com';
const BASE = 'https://jp.mercari.com';
const API_MATCH = '/v2/entities:search';
const TIMEOUT_MS = 12000;

// Mercari item-condition codes → human label (Japanese, as shown on listing).
const CONDITION_MAP = {
  1: '新品、未使用',
  2: '未使用に近い',
  3: '目立った傷や汚れなし',
  4: 'やや傷や汚れあり',
  5: '傷や汚れあり',
  6: '全体的に状態が悪い',
};

async function search(context, query, opts = {}) {
  const limit = opts.limit ?? 20;
  const pageNum = Math.max(1, opts.page || 1);
  const url = `${BASE}/search?keyword=${encodeURIComponent(query)}`;
  const page = await context.newPage();
  const start = Date.now();

  try {
    await paceDomain(HOST);

    // Listen for the API response BEFORE navigating, so we don't miss it.
    const apiResponsePromise = page
      .waitForResponse(
        (resp) => resp.url().includes(API_MATCH) && resp.request().method() === 'POST',
        { timeout: TIMEOUT_MS }
      )
      .catch(() => null);

    await page.goto(url, { timeout: TIMEOUT_MS, waitUntil: 'domcontentloaded' });

    const resp = await apiResponsePromise;
    if (!resp) {
      logger.warn(
        { scraper: SOURCE, status: 'no-api-response', durationMs: Date.now() - start },
        'mercari API not observed'
      );
      return [];
    }

    let body;
    try {
      body = await resp.json();
    } catch (err) {
      logger.warn(
        { scraper: SOURCE, status: 'bad-json', error: err.message },
        'mercari API JSON parse failed'
      );
      return [];
    }

    const apiItems = Array.isArray(body?.items) ? body.items : [];
    // Drop:
    //   - items not ON_SALE (sold/stopped/in trade — clicking these shows "エラーが発生しました")
    //   - non-MERCARI itemTypes (Beyond/Shops items use a different URL routing that
    //     `/item/<id>` does not always resolve cleanly to)
    const onSale = apiItems.filter(
      (it) =>
        it &&
        it.id &&
        it.name &&
        it.status === 'ITEM_STATUS_ON_SALE' &&
        (!it.itemType || it.itemType === 'ITEM_TYPE_MERCARI') &&
        !it.shop
    );
    // Mercari's API returns ~120 items in one response — paginate by slicing
    // rather than re-querying. Phase 2 may switch to API cursor (searchConditionId).
    const sliceStart = (pageNum - 1) * limit;
    const items = onSale
      .slice(sliceStart, sliceStart + limit)
      .map((it) => {
        const priceNum = Number.parseInt(it.price, 10);
        const condition = CONDITION_MAP[Number.parseInt(it.itemConditionId, 10)] || null;
        const image =
          it.thumbnails?.[0] ||
          it.photos?.[0]?.uri ||
          null;
        // Mercari ships UNIX seconds in `updated`/`created` strings.
        const tsSec = Number.parseInt(it.updated || it.created, 10);
        const updatedAt = Number.isFinite(tsSec) && tsSec > 0
          ? new Date(tsSec * 1000).toISOString()
          : null;
        return toItem({
          title: it.name,
          price: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : null,
          image,
          url: `${BASE}/item/${it.id}`,
          condition,
          source: SOURCE,
          updatedAt,
        });
      })
      .filter((it) => it.title && it.url);

    logger.info(
      { scraper: SOURCE, durationMs: Date.now() - start, itemCount: items.length, status: 'ok' },
      'scrape ok'
    );
    return items;
  } catch (err) {
    logger.error(
      { scraper: SOURCE, durationMs: Date.now() - start, error: err.message },
      'mercari scrape failed'
    );
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { search };
