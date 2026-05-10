const { logger } = require('../logger');
const { paceDomain } = require('../concurrency');
const { toItem } = require('./normalize');
const { parsePrice } = require('../util/parsePrice');
const { absoluteUrl } = require('../util/absoluteUrl');

const SOURCE = 'paypay';
const HOST = 'paypayfleamarket.yahoo.co.jp';
const BASE = 'https://paypayfleamarket.yahoo.co.jp';
const TIMEOUT_MS = 12000;
// PayPay shows this string and falls back to generic recommendations when it can't load
// search results — typically because the request originates from outside Japan.
const GEO_FAIL_MARKERS = ['データの取得に失敗しました', 'あなたへのおすすめ'];

async function search(context, query, opts = {}) {
  const limit = opts.limit ?? 20;
  const url = `${BASE}/search/${encodeURIComponent(query)}`;
  const page = await context.newPage();
  const start = Date.now();
  try {
    await paceDomain(HOST);
    await page.goto(url, { timeout: TIMEOUT_MS, waitUntil: 'domcontentloaded' });

    try {
      await page.waitForSelector('a[href*="/item/"]', { timeout: 6000 });
    } catch {
      logger.warn(
        { scraper: SOURCE, status: 'no-anchors', durationMs: Date.now() - start },
        'paypay no item anchors rendered'
      );
      return [];
    }

    // Detect the geo/data-failed fallback page. When this marker is on the page,
    // the visible items are unrelated recommendations, not search hits — return [].
    const pageText = await page.evaluate(() => document.body.innerText || '');
    if (GEO_FAIL_MARKERS.every((m) => pageText.includes(m))) {
      logger.warn(
        {
          scraper: SOURCE,
          status: 'geo-blocked',
          durationMs: Date.now() - start,
          hint: 'PayPay only serves search results to JP IPs — visible items are recommendations.',
        },
        'paypay geo-blocked or data-fetch-failed'
      );
      return [];
    }

    const raws = await page.$$eval(
      'a[href*="/item/"]',
      (anchors, arg) => {
        return anchors.slice(0, arg.limit).map((a) => {
          const href = a.getAttribute('href');
          const img = a.querySelector('img');
          const imageSrc = img?.getAttribute('src') || img?.getAttribute('data-src') || null;
          const imgAlt = img?.getAttribute('alt') || null;
          const text = (a.innerText || '').replace(/\s+/g, ' ').trim();
          const priceMatch = text.match(/([\d,]+)\s*円/);
          const priceText = priceMatch ? priceMatch[1] : null;
          return { href, image: imageSrc, title: imgAlt, priceText };
        });
      },
      { limit }
    );

    const items = raws
      .map((r) =>
        toItem({
          title: r.title,
          price: parsePrice(r.priceText),
          image: r.image ? absoluteUrl(r.image, BASE) : null,
          url: r.href ? absoluteUrl(r.href, BASE) : null,
          source: SOURCE,
        })
      )
      .filter((it) => it.title && it.url);

    logger.info(
      { scraper: SOURCE, durationMs: Date.now() - start, itemCount: items.length, status: 'ok' },
      'scrape ok'
    );
    return items;
  } catch (err) {
    logger.error(
      { scraper: SOURCE, durationMs: Date.now() - start, error: err.message },
      'paypay scrape failed'
    );
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { search };
