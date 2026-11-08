import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { navigate, parseRoute, paths, tabFor, useRoute } from './router';

afterEach(() => {
  window.location.hash = '';
  vi.restoreAllMocks();
});

describe('router (T3)', () => {
  it('parses tab routes, falling back to Recipes', () => {
    expect(parseRoute('')).toEqual({ name: 'recipes' });
    expect(parseRoute('#/')).toEqual({ name: 'recipes' });
    expect(parseRoute('#/log')).toEqual({ name: 'log' });
    expect(parseRoute('#/ingredients')).toEqual({ name: 'ingredients' });
    expect(parseRoute('#/more')).toEqual({ name: 'more' });
    expect(parseRoute('#/nonsense')).toEqual({ name: 'recipes' });
  });

  it('routes shared recipe links', () => {
    expect(parseRoute(paths.receive('abc_123'))).toEqual({ name: 'receive', data: 'abc_123' });
    expect(parseRoute('#r=')).toEqual({ name: 'recipes' });
    expect(tabFor({ name: 'receive', data: 'x' })).toBe('recipes');
    expect(tabFor({ name: 'log' })).toBe('log');
  });

  it('builds paths that parse back to the same tab', () => {
    for (const tab of ['recipes', 'log', 'ingredients', 'more'] as const) {
      expect(parseRoute(paths[tab]())).toEqual({ name: tab });
    }
  });

  it('follows hash changes and scrolls to the top', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { result } = renderHook(() => useRoute());
    expect(result.current).toEqual({ name: 'recipes' });
    act(() => {
      navigate(paths.log());
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current).toEqual({ name: 'log' });
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
