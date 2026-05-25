import { parseSmartRange, rangeLabel } from "../lib/date";

/** Text field for a date range using ".." (e.g. "1.1..t", "1.4..30.4", "t").
 *  Shows the interpreted range as a live hint. */
export function SmartRangeInput({
  value,
  onChange,
  label = "Period",
}: {
  value: string;
  onChange: (text: string) => void;
  label?: string;
}) {
  const range = parseSmartRange(value);
  const invalid = value.trim().length > 0 && !range;

  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input
        className={`input ${invalid ? "input-error" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. 1.1..t"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
      />
      {invalid ? (
        <span className="date-hint err">Try 1.1..t · 1.4..30.4 · t</span>
      ) : range ? (
        <span className="date-hint">{rangeLabel(range.from, range.to)}</span>
      ) : null}
    </div>
  );
}
