import type { BatchSize } from './types';

/**
 * Mixing progress, saved so a locked phone or a reload resumes on the same
 * step (M6). One session per recipe, keyed by recipe id; `sessionId` tells a
 * fresh run from an old one.
 */
export interface MixSession {
  sessionId: string;
  recipeId: string;
  size: BatchSize;
  /** Ingredient ids in the order they are weighed (M4, reorderable). */
  order: string[];
  /** 0..order.length-1 are ingredients; then Mix; then Fill. */
  step: number;
  /** Actual weights in grams, by ingredient id (M3). */
  actuals: Record<string, number>;
  startedAt: number;
}

const prefix = 'lmnt-calculator.mix.';

export function loadMixSession(recipeId: string): MixSession | undefined {
  try {
    const raw = localStorage.getItem(prefix + recipeId);
    if (!raw) return undefined;
    const s = JSON.parse(raw) as MixSession;
    if (s.recipeId !== recipeId || !Array.isArray(s.order) || typeof s.step !== 'number') return undefined;
    return s;
  } catch {
    return undefined;
  }
}

export function saveMixSession(session: MixSession): void {
  try {
    localStorage.setItem(prefix + session.recipeId, JSON.stringify(session));
  } catch {
    // Storage unavailable: mixing still works, it just can't resume.
  }
}

export function clearMixSession(recipeId: string): void {
  try {
    localStorage.removeItem(prefix + recipeId);
  } catch {
    // Nothing to clear.
  }
}

export function hasMixSession(recipeId: string): boolean {
  return loadMixSession(recipeId) !== undefined;
}

/** Moves the item at `from` to `to`, returning a new array. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/** Keeps a saved order valid if the recipe changed: drops missing ids and appends new ones. */
export function reconcileOrder(saved: string[], current: string[]): string[] {
  const kept = saved.filter((id) => current.includes(id));
  return [...kept, ...current.filter((id) => !kept.includes(id))];
}
