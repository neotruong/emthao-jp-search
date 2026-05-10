const { logger } = require('../logger');
const { paceDomain } = require('../concurrency');
const { toItem } = require('./normalize');
const { parsePrice } = require('../util/parsePrice');
const { absoluteUrl } = require('../util/absoluteUrl');

const SOURCE = 'yahoo';
const HOST = 'auctions.yahoo.co.jp';
const BASE = 'https://auctions.yahoo.co.jp';
const TIMEOUT_MS = 12000;

function buildUrl(query, mode, page, limit) {
  let url = `${BASE}/search/search?p=${encodeURIComponent(query)}&va=${encodeURIComponent(query)}`;
  if (mode === 'auction') url += '&fixed=2';
  if (mode === 'fixed') url += '&fixed=1';
  // Yahoo paginates with `b=<1-indexed offset>&n=<page-size>`.
  if (page && page > 1) {
    const offset = (page - 1) * limit + 1;
    url += `&b=${offset}&n=${limit}`;
  } else if (limit) {
    url += `&n=${limit}`;
  }
  return url;
}

async function search(context, query, opts = {}) {
  const limit = opts.limit ?? 20;
  const pageNum = Math.max(1, opts.page || 1);
  const mode = opts.yahooMode || 'all';
  const url = buildUrl(query, mode, pageNum, limit);
  const page = await context.newPage();
  const start = Date.now();
  try {
    await paceDomain(HOST);
    await page.goto(url, { timeout: TIMEOUT_MS, waitUntil: 'domcontentloaded' });

    const remaining = TIMEOUT_MS - (Date.now() - start);
    try {
      await page.waitForSelector('li.Product', { timeout: Math.max(1000, remaining) });
    } catch {
      logger.warn(
        { scraper: SOURCE, status: 'no-items', mode, durationMs: Date.now() - start },
        'yahoo .Product not found'
      );
      return [];
    }

    const raws = await page.$$eval(
      'li.Product',
      (cards, arg) => {
        return cards.slice(0, arg.limit).map((card) => {
          const titleLink =
            card.querySelector('.Product__titleLink') ||
            card.querySelector('.Product__title a') ||
            card.querySelector('a[href*="/auction/"]');
          const titleEl = card.querySelector('.Product__title') || titleLink;
          const title = (titleEl?.textContent || '').trim() || null;
          const href = titleLink?.getAttribute('href') || null;

          const priceEl = card.querySelector('.Product__priceValue') || card.querySelector('.Product__price');
          const priceText = priceEl?.textContent || null;

          const img =
            card.querySelector('.Product__image img') ||
            card.querySelector('.Product__imageBox img') ||
            card.querySelector('img');
          const imageSrc = img?.getAttribute('src') || img?.getAttribute('data-src') || null;

          const bidEl = card.querySelector('.Product__bid') || card.querySelector('.Product__bidValue');
          const bidText = bidEl?.textContent?.trim() || null;

          const timeEl = card.querySelector('.Product__time') || card.querySelector('.Product__timeValue');
          const timeText = timeEl?.textContent?.trim() || null;

          const cardText = card.textContent || '';
          const isFixed =
            !!card.querySelector('.Product__icon--buynow, [class*="buynow" i]') || /即決/.test(cardText);

          return { title, priceText, image: imageSrc, href, bidText, timeText, isFixed };
        });
      },
      { limit }
    );

    const items = raws
      .map((r) => {
        // When the URL filtered for one mode, every result is that mode by definition.
        // Only fall back to per-card heuristic when querying 'all'.
        let resolvedMode;
        if (mode === 'auction') resolvedMode = 'auction';
        else if (mode === 'fixed') resolvedMode = 'fixed';
        else resolvedMode = r.isFixed ? 'fixed' : 'auction';

        return toItem({
          title: r.title,
          price: parsePrice(r.priceText),
          image: r.image ? absoluteUrl(r.image, BASE) : null,
          url: r.href ? absoluteUrl(r.href, BASE) : null,
          source: SOURCE,
          bidCount: r.bidText ? parseInt(String(r.bidText).replace(/[^\d]/g, ''), 10) || null : null,
          timeLeft: r.timeText,
          mode: resolvedMode,
        });
      })
      .filter((it) => it.title && it.url);

    logger.info(
      { scraper: SOURCE, durationMs: Date.now() - start, itemCount: items.length, mode, status: 'ok' },
      'scrape ok'
    );
    return items;
  } catch (err) {
    logger.error(
      { scraper: SOURCE, durationMs: Date.now() - start, error: err.message },
      'yahoo scrape failed'
    );
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { search };
