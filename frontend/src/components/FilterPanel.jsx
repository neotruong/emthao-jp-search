import { CONDITION_BUCKETS } from '../lib/filters';

export function FilterPanel({ filters, onChange, onReset, totalCount, filteredCount }) {
  const {
    currency = 'jpy',
    priceMin,
    priceMax,
    vndMin,
    vndMax,
    conditionBuckets,
  } = filters;

  const setCurrency = (cur) => onChange({ ...filters, currency: cur });

  const setNumeric = (key, raw) => {
    const trimmed = String(raw ?? '').trim();
    if (trimmed === '') {
      onChange({ ...filters, [key]: null });
      return;
    }
    // Strip thousands separators (commas, spaces, dots used as group sep) but
    // keep one decimal point. For our integer JPY/VND fields, drop all non-digits.
    const digits = trimmed.replace(/[^\d]/g, '');
    const v = digits === '' ? null : Number.parseInt(digits, 10);
    onChange({ ...filters, [key]: Number.isFinite(v) ? v : null });
  };

  const toggleBucket = (id) => {
    const cur = conditionBuckets || [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    onChange({ ...filters, conditionBuckets: next });
  };

  const hasActive =
    priceMin != null ||
    priceMax != null ||
    vndMin != null ||
    vndMax != null ||
    (conditionBuckets && conditionBuckets.length > 0);

  // Active currency's bound fields
  const activeMin = currency === 'vnd' ? vndMin : priceMin;
  const activeMax = currency === 'vnd' ? vndMax : priceMax;
  const activeMinKey = currency === 'vnd' ? 'vndMin' : 'priceMin';
  const activeMaxKey = currency === 'vnd' ? 'vndMax' : 'priceMax';
  const symbol = currency === 'vnd' ? 'đ' : '¥';
  const placeholderMin = currency === 'vnd' ? 'Min VND' : 'Min ¥';
  const placeholderMax = currency === 'vnd' ? 'Max VND' : 'Max ¥';

  return (
    <div className="filter-panel">
      <div className="filter-row">
        <span className="filter-label">Price</span>
        <div className="currency-toggle" role="tablist" aria-label="Filter currency">
          <button
            type="button"
            className={`currency-tab ${currency === 'jpy' ? 'active' : ''}`}
            onClick={() => setCurrency('jpy')}
            role="tab"
            aria-selected={currency === 'jpy'}
          >
            JPY
          </button>
          <button
            type="button"
            className={`currency-tab ${currency === 'vnd' ? 'active' : ''}`}
            onClick={() => setCurrency('vnd')}
            role="tab"
            aria-selected={currency === 'vnd'}
          >
            VND
          </button>
        </div>
        <div className="filter-price-pair">
          <span className="filter-currency-symbol">{symbol}</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder={placeholderMin}
            className="filter-price"
            value={activeMin ?? ''}
            onChange={(e) => setNumeric(activeMinKey, e.target.value)}
          />
          <span className="filter-dash">—</span>
          <span className="filter-currency-symbol">{symbol}</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder={placeholderMax}
            className="filter-price"
            value={activeMax ?? ''}
            onChange={(e) => setNumeric(activeMaxKey, e.target.value)}
          />
        </div>
      </div>

      <div className="filter-row">
        <span className="filter-label">Condition</span>
        <div className="condition-pills">
          {CONDITION_BUCKETS.map((b) => {
            const on = (conditionBuckets || []).includes(b.id);
            return (
              <button
                key={b.id}
                type="button"
                className={`condition-pill ${on ? 'active' : ''}`}
                onClick={() => toggleBucket(b.id)}
                aria-pressed={on}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="filter-summary">
        <span className="filter-count">
          {hasActive ? `${filteredCount} of ${totalCount}` : `${totalCount} items`}
        </span>
        {hasActive && (
          <button type="button" className="filter-reset" onClick={onReset}>
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}
