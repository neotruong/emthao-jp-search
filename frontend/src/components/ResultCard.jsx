import { PriceBlock } from './PriceBlock';
import { BookmarkButton } from './BookmarkButton';
import { toTranslateUrl } from '../lib/translateUrl';
import { translateCondition, translateTimeLeft } from '../lib/labels';

const SOURCE_LABEL = {
  mercari: 'Mercari',
  yahoo: 'Yahoo',
  paypay: 'PayPay',
};

export function ResultCard({ item, weightKg, pricing, isBookmarked, onToggleBookmark }) {
  const translated = toTranslateUrl(item.url);
  const sourceCls = `src-${item.source}`;

  return (
    <article className="card">
      <a className="card-image-link" href={item.url} target="_blank" rel="noopener noreferrer">
        {item.image ? (
          <img src={item.image} alt={item.title} loading="lazy" />
        ) : (
          <div className="card-image-placeholder">No image</div>
        )}
        <span className={`card-source ${sourceCls}`}>{SOURCE_LABEL[item.source] || item.source}</span>
        {item.mode && (
          <span className={`card-mode mode-${item.mode}`}>
            {item.mode === 'auction' ? 'Auction' : 'Buy Now'}
          </span>
        )}
      </a>

      <div className="card-body">
        <h3 className="card-title" title={item.title}>{item.title}</h3>
        <PriceBlock jpy={item.price} weightKg={weightKg} pricing={pricing} />

        <div className="card-meta">
          {item.condition && <span className="meta-chip">{translateCondition(item.condition)}</span>}
          {item.bidCount != null && <span className="meta-chip">{item.bidCount} bids</span>}
          {item.timeLeft && <span className="meta-chip">{translateTimeLeft(item.timeLeft)}</span>}
        </div>

        <div className="card-actions">
          <a className="btn btn-primary" href={translated} target="_blank" rel="noopener noreferrer">
            Translated
          </a>
          <a className="btn btn-secondary" href={item.url} target="_blank" rel="noopener noreferrer">
            Original
          </a>
          <BookmarkButton isBookmarked={isBookmarked} onToggle={onToggleBookmark} />
        </div>
      </div>
    </article>
  );
}
