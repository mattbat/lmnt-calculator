import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, followSystemTheme, resolveTheme, setThemePreference, themePreference, THEME_KEY } from './theme';

/** Pretends the phone is set to light or dark, and lets a test flip it. */
function mockSystem(light: boolean) {
  const listeners: (() => void)[] = [];
  const query = {
    get matches() {
      return light;
    },
    addEventListener: (_: string, listener: () => void) => listeners.push(listener),
  };
  vi.stubGlobal('matchMedia', () => query);
  return {
    set(value: boolean) {
      light = value;
      listeners.forEach((l) => l());
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  document.head.innerHTML = '<meta name="theme-color" content="#12121f" />';
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const meta = () => document.querySelector('meta[name="theme-color"]')!.getAttribute('content');

describe('theme (§11)', () => {
  it('follows the phone by default, and ignores values it does not know', () => {
    expect(themePreference()).toBe('auto');
    localStorage.setItem(THEME_KEY, 'purple');
    expect(themePreference()).toBe('auto');
  });

  it('remembers the choice and shows it straight away', () => {
    setThemePreference('light');
    expect(themePreference()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(meta()).toBe('#f5f5fb');
    setThemePreference('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(meta()).toBe('#12121f');
  });

  it('matches the phone when set to auto', () => {
    mockSystem(true);
    expect(resolveTheme('auto')).toBe('light');
    mockSystem(false);
    expect(resolveTheme('auto')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });

  it('follows the phone switching between light and dark, only on auto', () => {
    const system = mockSystem(false);
    setThemePreference('auto');
    followSystemTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');
    system.set(true);
    expect(document.documentElement.dataset.theme).toBe('light');

    setThemePreference('dark');
    system.set(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('still works without matchMedia or storage', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(resolveTheme('auto')).toBe('dark');
    expect(() => followSystemTheme()).not.toThrow();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => setThemePreference('light')).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(themePreference()).toBe('auto');
    applyTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
