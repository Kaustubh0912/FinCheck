// Smart date parsing for the transaction date field.
// Accepts shorthand and normalises it, day-first (D M Y):
//   "1.1.26" / "1 1 26" / "1/1/26" / "01/01/2026"  -> 1 Jan 2026
//   "1.1"   -> 1 <currentMonth? no: month=1> ... -> 1 Jan, current year
//   "1" / "21" -> that day in the current month & year
//   "t" / "today" -> today   ("y"/"yesterday", "tm"/"tomorrow" also work)
//   "1 jan", "jan 1", "1 jan 26" -> month names supported too

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function atNoon(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}
function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}
function normalizeYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

export function parseSmartDate(raw: string, base = new Date()): Date | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  if (s === "t" || s === "today" || s === "now") return atNoon(base);
  if (s === "y" || s === "yest" || s === "yesterday") {
    const d = new Date(base);
    d.setDate(d.getDate() - 1);
    return atNoon(d);
  }
  if (s === "tm" || s === "tmr" || s === "tomorrow") {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    return atNoon(d);
  }

  const tokens = s.split(/[\s./\-,]+/).filter(Boolean);
  if (!tokens.length) return null;

  let monthFromName: number | null = null;
  const nums: number[] = [];
  for (const tk of tokens) {
    if (/^\d+$/.test(tk)) {
      nums.push(parseInt(tk, 10));
      continue;
    }
    const mi = MONTHS.findIndex((m) => tk.startsWith(m));
    if (mi >= 0) {
      monthFromName = mi + 1;
      continue;
    }
    return null; // unrecognised token
  }

  const curMonth = base.getMonth() + 1;
  const curYear = base.getFullYear();
  let day: number;
  let month: number;
  let year: number;

  if (monthFromName != null) {
    month = monthFromName;
    day = nums.length >= 1 ? nums[0] : 1;
    year = nums.length >= 2 ? nums[1] : curYear;
  } else if (nums.length === 1) {
    day = nums[0];
    month = curMonth;
    year = curYear;
  } else if (nums.length === 2) {
    day = nums[0];
    month = nums[1];
    year = curYear;
  } else {
    day = nums[0];
    month = nums[1];
    year = nums[2];
  }

  year = normalizeYear(year);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(month, year)) return null;

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** Local yyyy-mm-dd (no timezone shift). */
export function toYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "1 Jan 2026" — or "Thu, 1 Jan 2026" with the weekday. Day-first, locale-independent. */
export function friendlyDate(ymd: string, withWeekday = false): string {
  const d = new Date(ymd + "T12:00:00");
  if (Number.isNaN(d.getTime())) return ymd;
  const base = `${d.getDate()} ${MONTHS_FULL[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  if (!withWeekday) return base;
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  return `${wd}, ${base}`;
}
