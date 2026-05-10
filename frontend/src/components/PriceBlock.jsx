import { jpyToVnd, formatJpy, formatVnd } from '../lib/pricing';

export function PriceBlock({ jpy, weightKg, pricing }) {
  const vnd = jpyToVnd(jpy, weightKg, pricing);
  return (
    <div className="price-block">
      <div className="price-jpy">{formatJpy(jpy)}</div>
      <div className="price-vnd">≈ {formatVnd(vnd)}</div>
    </div>
  );
}
