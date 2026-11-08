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

  it('sends old #r= links to the Recipes screen', () => {
    expect(parseRoute('#r=1pabc_123')).toEqual({ name: 'recipes' });
    expect(parseRoute('#r=')).toEqual({ name: 'recipes' });
    expect(tabFor({ name: 'log' })).toBe('log');
  });

  it('parses detail routes', () => {
    expect(parseRoute('#/recipe/lemon')).toEqual({ name: 'recipe', id: 'lemon' });
    expect(parseRoute('#/recipe/lemon/edit')).toEqual({ name: 'recipe', id: 'lemon' });
    expect(parseRoute('#/recipe')).toEqual({ name: 'recipes' });
    expect(parseRoute('#/mix/lemon')).toEqual({ name: 'mix', id: 'lemon' });
    expect(parseRoute('#/mix')).toEqual({ name: 'recipes' });
    expect(parseRoute('#/log/abc')).toEqual({ name: 'logEntry', id: 'abc' });
    expect(parseRoute('#/more/settings')).toEqual({ name: 'settings' });
    expect(parseRoute('#/more/about')).toEqual({ name: 'about' });
    expect(parseRoute('#/more/help')).toEqual({ name: 'help' });
    expect(parseRoute('#/more/other')).toEqual({ name: 'more' });
    expect(parseRoute('#/recipe/%E0%A4%A')).toEqual({ name: 'recipes' });
    expect(parseRoute(paths.recipe('a b'))).toEqual({ name: 'recipe', id: 'a b' });
    expect(parseRoute(paths.mix('x'))).toEqual({ name: 'mix', id: 'x' });
    expect(parseRoute(paths.logEntry('x'))).toEqual({ name: 'logEntry', id: 'x' });
    expect(tabFor({ name: 'mix', id: 'x' })).toBe('recipes');
    expect(tabFor({ name: 'logEntry', id: 'x' })).toBe('log');
    expect(tabFor({ name: 'help' })).toBe('more');
    expect(tabFor({ name: 'recipe', id: 'x' })).toBe('recipes');
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
