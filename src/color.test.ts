import { describe, expect, it } from 'vitest';
import { RECIPE_COLORS, readableInk } from './color';

describe('readableInk', () => {
  it('picks dark text on light colors and white on dark ones', () => {
    expect(readableInk('#facc15')).toBe('#111111');
    expect(readableInk('#f43f5e')).toBe('#111111');
    expect(readableInk('#1e293b')).toBe('#ffffff');
    expect(readableInk('not a color')).toBe('#111111');
  });
  it('has a palette of valid colors', () => {
    expect(RECIPE_COLORS.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
  });
});
