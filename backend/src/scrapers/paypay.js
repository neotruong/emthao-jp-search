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
    // Homepage warmup. Without a prior hit on the Yahoo!フリマ domain, /search/<q>
    // returns 404 + the "データの取得に失敗しました" banner from non-JP IPs (the SPA's
    // first data-fetch is server-gated). After any homepage load, a session cookie
    // is minted and /search returns HTTP 200 with the real result anchors.
    await paceDomain(HOST);
    await page.goto(BASE, { timeout: TIMEOUT_MS, waitUntil: 'domcontentloaded' });

    await paceDomain(HOST);
    const resp = await page.goto(url, { timeout: TIMEOUT_MS, waitUntil: 'domcontentloaded' });

    if (resp && resp.status() !== 200) {
      logger.warn(
        {
          scraper: SOURCE,
          status: 'http-error',
          httpStatus: resp.status(),
          durationMs: Date.now() - start,
        },
        'paypay search returned non-200 after warmup'
      );
      return [];
    }

    try {
      await page.waitForSelector('a[href*="/item/"]', { timeout: 6000 });
    } catch {
      logger.warn(
        { scraper: SOURCE, status: 'no-anchors', durationMs: Date.now() - start },
        'paypay no item anchors rendered'
      );
      return [];
    }

    // Defensive: even after warmup, surface the geo/data-failed fallback if it appears.
    // Both markers must be present together — the recommendations heading alone shows up
    // legitimately on some pages.
    const pageText = await page.evaluate(() => document.body.innerText || '');
    if (GEO_FAIL_MARKERS.every((m) => pageText.includes(m))) {
      logger.warn(
        {
          scraper: SOURCE,
          status: 'geo-blocked',
          durationMs: Date.now() - start,
          hint: 'Homepage warmup did not unblock search — Yahoo may have tightened geo-gating.',
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
