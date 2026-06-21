const COLOR_MAP: Record<string, string> = {
  "#6366f1": "var(--cat-indigo)",
  "#8b5cf6": "var(--cat-violet)",
  "#ec4899": "var(--cat-pink)",
  "#ef4444": "var(--cat-red)",
  "#f97316": "var(--cat-orange)",
  "#eab308": "var(--cat-yellow)",
  "#16a34a": "var(--cat-green)",
  "#0ea5e9": "var(--cat-sky)",
  "#14b8a6": "var(--cat-teal)",
  "#64748b": "var(--cat-slate)",
};

/**
 * Transforms a raw hex color from the database into a CSS variable
 * if it matches a known palette color. This allows the color to adapt
 * seamlessly to light/dark themes via CSS.
 */
export function resolveThemeColor(hex: string | null | undefined): string {
  if (!hex) return "var(--cat-slate)";
  return COLOR_MAP[hex.toLowerCase()] || hex;
}
