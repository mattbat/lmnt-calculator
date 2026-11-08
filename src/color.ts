/** Recipe colors (§14): a small palette that works on cards in both themes. */
export const RECIPE_COLORS = [
  '#64748b',
  '#facc15',
  '#f43f5e',
  '#fb923c',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#a855f7',
];

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.2;
  const n = parseInt(m[1]!, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Text color (near-black or white) with the better contrast on `background` (WCAG AA). */
export function readableInk(background: string): string {
  const l = luminance(background);
  const onWhite = 1.05 / (l + 0.05);
  const onDark = (l + 0.05) / 0.0575;
  return onWhite >= onDark ? '#ffffff' : '#111111';
}
