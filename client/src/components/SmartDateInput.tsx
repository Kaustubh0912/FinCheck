import { useEffect, useState } from "react";
import { friendlyDate, parseSmartDate, toYmd } from "../lib/date";

/** A text date field that parses shorthand (1.1.26, 1 jan, 21, t) and snaps to a clean date. */
export function SmartDateInput({ value, onChange }: { value: string; onChange: (ymd: string) => void }) {
  const [text, setText] = useState(() => friendlyDate(value));
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState(false);

  // Resync when the value changes externally (sheet opened / editing a txn),
  // but leave the user's in-progress text alone if it already matches.
  useEffect(() => {
    const parsed = parseSmartDate(text);
    if (parsed && toYmd(parsed) === value) return;
    setText(friendlyDate(value));
    setError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(raw: string) {
    setText(raw);
    setError(false);
    const d = parseSmartDate(raw);
    if (d) onChange(toYmd(d)); // commit live so submit always has the latest
  }

  function handleBlur() {
    setFocused(false);
    const d = parseSmartDate(text);
    if (d) {
      const ymd = toYmd(d);
      onChange(ymd);
      setText(friendlyDate(ymd));
      setError(false);
    } else if (!text.trim()) {
      setText(friendlyDate(value));
    } else {
      setError(true);
    }
  }

  const parsedNow = parseSmartDate(text);
  let hint: string | null = null;
  let hintErr = false;
  if (error) {
    hint = "Couldn’t read that — try 1.1.26, 1 jan, 21 or t";
    hintErr = true;
  } else if (focused && parsedNow) {
    hint = friendlyDate(toYmd(parsedNow), true);
  } else if (focused) {
    hint = "Try 1.1.26 · 1 jan · 21 · t";
  }

  return (
    <div className="field">
      <label className="field-label">Date</label>
      <input
        className={`input ${error ? "input-error" : ""}`}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="e.g. 1.1.26, 1 jan, 21, t"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
      />
      {hint && <span className={`date-hint ${hintErr ? "err" : ""}`}>{hint}</span>}
    </div>
  );
}
