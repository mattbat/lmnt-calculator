import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMixSession, hasMixSession, loadMixSession, moveItem, reconcileOrder, saveMixSession, type MixSession } from './mixSession';

const session: MixSession = {
  sessionId: 's1',
  recipeId: 'lemon',
  size: { mode: 'servings', servings: 30 },
  order: ['a', 'b'],
  step: 1,
  startedAt: 1,
};

beforeEach(() => localStorage.clear());

describe('mix session storage', () => {
  it('saves, loads and clears a session', () => {
    expect(loadMixSession('lemon')).toBeUndefined();
    saveMixSession(session);
    expect(hasMixSession('lemon')).toBe(true);
    expect(loadMixSession('lemon')).toEqual(session);
    clearMixSession('lemon');
    expect(hasMixSession('lemon')).toBe(false);
  });
  it('reads a session sized by vials (from before vials were dropped) as servings', () => {
    localStorage.setItem('lmnt-calculator.mix.lemon', JSON.stringify({ ...session, size: { mode: 'vials', vials: 12 } }));
    expect(loadMixSession('lemon')?.size).toEqual({ mode: 'servings', servings: 12 });
    localStorage.setItem('lmnt-calculator.mix.lemon', JSON.stringify({ ...session, size: { mode: 'nope' } }));
    expect(loadMixSession('lemon')).toBeUndefined();
  });
  it('ignores damaged data and unavailable storage', () => {
    localStorage.setItem('lmnt-calculator.mix.lemon', 'nope');
    expect(loadMixSession('lemon')).toBeUndefined();
    localStorage.setItem('lmnt-calculator.mix.lemon', JSON.stringify({ recipeId: 'other' }));
    expect(loadMixSession('lemon')).toBeUndefined();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveMixSession(session)).not.toThrow();
    expect(() => clearMixSession('lemon')).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe('order helpers', () => {
  it('moves items and stays in range', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 5)).toEqual(['a', 'b']);
  });
  it('reconciles a saved order with the recipe', () => {
    expect(reconcileOrder(['b', 'x', 'a'], ['a', 'b', 'c'])).toEqual(['b', 'a', 'c']);
  });
});
