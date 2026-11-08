import { describe, expect, it } from 'vitest';
import { recipeFragment, formatDate, formatDateTime, mg, money, parseNum, perServing, plain } from './format';

describe('format helpers', () => {
  it('formats money, milligrams and per-serving weights', () => {
    expect(money(0.1)).toBe('$0.10');
    expect(money(-1.5)).toBe('-$1.50');
    expect(mg(949.6)).toBe('950 mg');
    expect(perServing(0.385, 'g')).toBe('0.385 g');
    expect(perServing(28.3495, 'oz')).toBe('1.0000 oz');
    expect(plain(2.5)).toBe('2.5');
    expect(plain(0.123456)).toBe('0.1235');
  });
  it('parses typed numbers', () => {
    expect(parseNum('12.5')).toBe(12.5);
    expect(parseNum(' 12,5 ')).toBe(12.5);
    expect(parseNum('')).toBeUndefined();
    expect(parseNum('abc')).toBeUndefined();
  });
  it('finds the recipe part of a pasted link', () => {
    expect(recipeFragment('see https://x.test/lmnt-calculator/#r=1pabc_-')).toBe('r=1pabc_-');
    expect(recipeFragment('#r=1zabc')).toBe('r=1zabc');
    expect(recipeFragment('r=1zabc')).toBe('r=1zabc');
    expect(recipeFragment('nothing here')).toBeUndefined();
  });
  it('formats dates', () => {
    expect(formatDate(0)).toMatch(/19/);
    expect(formatDateTime(0)).toMatch(/19/);
  });
});
