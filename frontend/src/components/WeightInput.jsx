import { useEffect, useState } from 'react';

const MIN_KG = 0.1;
const STEP = 0.1;

// Parse a weight input that may use either '.' or ',' as the decimal separator
// (Vietnamese locale uses ','). Falls back to e.target.valueAsNumber when valid.
function parseWeight(input, valueAsNumber) {
  if (Number.isFinite(valueAsNumber)) return valueAsNumber;
  if (input == null) return NaN;
  const cleaned = String(input).replace(',', '.').replace(/[^\d.]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export function WeightInput({ value, onChange }) {
  // Local input string lets the user type "0,1" or "0.1" without React clobbering
  // intermediate states (e.g. typing "0." would otherwise round-trip to "0").
  const [text, setText] = useState(() => String(value ?? MIN_KG));

  useEffect(() => {
    // Sync external value changes (e.g. cleared from elsewhere) into the input.
    const asString = String(value ?? '');
    if (text === '' || Number.parseFloat(text.replace(',', '.')) !== Number(value)) {
      setText(asString);
    }
    // intentionally not syncing on `text` change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (raw, valueAsNumber) => {
    setText(raw);
    const n = parseWeight(raw, valueAsNumber);
    if (Number.isFinite(n) && n >= MIN_KG) onChange(Number(n.toFixed(2)));
  };

  const blur = () => {
    // On blur, snap to a valid value (>= MIN) and reformat.
    const n = parseWeight(text);
    if (!Number.isFinite(n) || n < MIN_KG) {
      const fixed = MIN_KG;
      setText(String(fixed));
      onChange(fixed);
    } else {
      setText(String(Number(n.toFixed(2))));
    }
  };

  return (
    <label className="weight-input" title="Used to compute the VND shipping component">
      <span className="weight-label">Weight</span>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9.,]*"
        className="weight-field"
        value={text}
        step={STEP}
        onChange={(e) => commit(e.target.value, e.target.valueAsNumber)}
        onBlur={blur}
        aria-label="Weight in kilograms"
      />
      <span className="weight-unit">kg</span>
    </label>
  );
}
