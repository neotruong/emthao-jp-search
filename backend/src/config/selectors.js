module.exports = {
  mercari: {
    verifiedAt: '2026-05-10',
    item: '[data-testid="item-cell"]',
    notes: 'Mercari uses Web Components: <mer-item-thumbnail> with item-name attr; <mer-price> with value attr.',
  },
  yahoo: {
    verifiedAt: '2026-05-10',
    item: 'li.Product, .Product',
    titleLink: '.Product__titleLink, .Product__title a',
    title: '.Product__title, .Product__titleLink',
    price: '.Product__priceValue, .Product__price',
    image: '.Product__image img, .Product__imageBox img',
    bidCount: '.Product__bid, .Product__bidValue',
    timeLeft: '.Product__time, .Product__timeValue',
    notes: 'fixed=2 (auction only), fixed=1 (buyout only), no fixed param = both',
  },
  paypay: {
    verifiedAt: '2026-05-10',
    itemChain: ['[data-cy="item-card"]', '[class*="ItemCard"]', 'article a[href*="/item/"]'],
    notes: 'React SPA with hashed class names — fall back through chain. Lazy-load triggered by scroll.',
  },
};
