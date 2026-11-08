import { afterEach, describe, expect, it, vi } from 'vitest';
import { fitIosAppHeight, iosAppHeight } from './viewport';

const iphone = { width: 402, height: 874 };

describe('iosAppHeight', () => {
  it('uses the screen height for an installed iPhone app in portrait', () => {
    expect(iosAppHeight({ standalone: true }, iphone, false)).toBe(874);
  });

  it('uses the short side in landscape (iOS keeps screen in portrait terms)', () => {
    expect(iosAppHeight({ standalone: true }, iphone, true)).toBe(402);
    expect(iosAppHeight({ standalone: true }, { width: 874, height: 402 }, false)).toBe(874);
  });

  it('leaves Safari tabs, Android and desktop to CSS', () => {
    expect(iosAppHeight({ standalone: false }, iphone, false)).toBeUndefined();
    expect(iosAppHeight({}, iphone, false)).toBeUndefined();
  });

  it('ignores a screen with no size', () => {
    expect(iosAppHeight({ standalone: true }, { width: 0, height: 0 }, false)).toBeUndefined();
  });
});

describe('fitIosAppHeight', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--app-h');
    vi.unstubAllGlobals();
  });

  it('sets --app-h on an installed iPhone app and updates on rotation', () => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    vi.stubGlobal('screen', { width: 402, height: 874 });
    let landscape = false;
    vi.stubGlobal('matchMedia', () => ({ matches: landscape }));
    window.matchMedia = (() => ({ matches: landscape })) as unknown as typeof window.matchMedia;
    fitIosAppHeight();
    expect(document.documentElement.style.getPropertyValue('--app-h')).toBe('874px');
    landscape = true;
    window.dispatchEvent(new Event('orientationchange'));
    expect(document.documentElement.style.getPropertyValue('--app-h')).toBe('402px');
    Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true });
  });

  it('sets nothing in a browser tab', () => {
    Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true });
    fitIosAppHeight();
    expect(document.documentElement.style.getPropertyValue('--app-h')).toBe('');
  });
});
