import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_INGREDIENTS, DEFAULT_RECIPES, DEFAULT_SETTINGS } from '../calc/defaults';
import type { BatchLogEntry } from '../types';
import { db, requestPersistentStorage, SETTINGS_ID } from './db';
import { resetDb } from './fixtures';
import {
  createBatch,
  RepoError,
  deleteBatch,
  getSettings,
  newId,
  setLastBatchSize,
  snoozeBackupReminder,
  updateBatchNotes,
  updateBatchRating,
  updateSettings,
  useBatches,
  useIngredients,
  useRecipe,
  useRecipes,
  useSettings,
} from './repo';

beforeEach(resetDb);

function batchInput(recipeId: string, madeAt: number): Omit<BatchLogEntry, 'id' | 'updatedAt'> {
  return {
    madeAt,
    recipeId,
    recipeSnapshot: { name: 'Raw', color: '#fff', lines: [{ ingredientId: 'salt', gramsPerServing: 2.5 }] },
    servings: 30,
    vials: 30,
    servingsPerVial: 1,
    fillGramsPerVial: 3.275,
    lines: [{ ingredientId: 'salt', name: 'Salt', gramsPerServing: 2.5, targetGrams: 75 }],
    totalCost: 3,
    notes: '',
  };
}

describe('seeding (T5)', () => {
  it('seeds only settings on first open; recipes and ingredients are not stored', async () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual(['batches', 'settings']);
    const settings = await getSettings();
    expect(settings).toMatchObject({ ...DEFAULT_SETTINGS, id: SETTINGS_ID });
    expect(settings.updatedAt).toBeGreaterThan(0);
  });

  it('does not reseed an existing database', async () => {
    await db.settings.update(SETTINGS_ID, { weightUnit: 'oz' });
    db.close();
    await db.open();
    expect((await getSettings()).weightUnit).toBe('oz');
  });

  it('requests persistent storage and survives its absence or failure', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { storage: { persist } });
    expect(await requestPersistentStorage()).toBe(true);
    vi.stubGlobal('navigator', { storage: {} });
    expect(await requestPersistentStorage()).toBe(false);
    vi.stubGlobal('navigator', { storage: { persist: () => Promise.reject(new Error('no')) } });
    expect(await requestPersistentStorage()).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('ids', () => {
  it('makes unique ids, with a fallback when randomUUID is missing', () => {
    expect(newId()).not.toBe(newId());
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
  });
});

describe('batches', () => {
  it('creates, edits notes and rating, and deletes', async () => {
    const batch = await createBatch(batchInput('raw', 100));
    expect(batch.updatedAt).toBeGreaterThan(0);
    await db.batches.update(batch.id, { updatedAt: 1 });
    await updateBatchNotes(batch.id, 'A bit sour');
    let stored = (await db.batches.get(batch.id))!;
    expect(stored.notes).toBe('A bit sour');
    expect(stored.updatedAt).toBeGreaterThan(1);
    await updateBatchRating(batch.id, 4);
    expect((await db.batches.get(batch.id))!.rating).toBe(4);
    await updateBatchRating(batch.id, undefined);
    stored = (await db.batches.get(batch.id))!;
    expect('rating' in stored).toBe(false);
    await expect(updateBatchRating(batch.id, 6)).rejects.toThrow(RepoError);
    await expect(updateBatchRating(batch.id, 2.5)).rejects.toThrow(RepoError);
    await updateBatchRating('missing', 3);
    await deleteBatch(batch.id);
    expect(await db.batches.count()).toBe(0);
  });
});

describe('settings', () => {
  it('updates partially and remembers batch sizes', async () => {
    await db.settings.update(SETTINGS_ID, { updatedAt: 1 });
    await updateSettings({ weightUnit: 'oz' });
    const settings = await getSettings();
    expect(settings.weightUnit).toBe('oz');
    expect(settings.retailPricePerServing).toBe(DEFAULT_SETTINGS.retailPricePerServing);
    expect(settings.updatedAt).toBeGreaterThan(1);
    await setLastBatchSize('raw', { mode: 'weight', grams: 100 });
    expect((await getSettings()).lastBatchSize.raw).toEqual({ mode: 'weight', grams: 100 });
  });

  it('throws a friendly error when the row is missing', async () => {
    await db.settings.clear();
    await expect(getSettings()).rejects.toThrow(RepoError);
  });
});

describe('settings snooze', () => {
  it('hides the backup reminder for 30 days', async () => {
    await snoozeBackupReminder(1000);
    expect((await getSettings()).backupReminderSnoozedUntil).toBe(1000 + 30 * 24 * 60 * 60 * 1000);
    await snoozeBackupReminder();
    expect((await getSettings()).backupReminderSnoozedUntil).toBeGreaterThan(Date.now());
  });
});

describe('hooks', () => {
  it('serve the built-in recipes and ingredients synchronously', () => {
    const recipes = renderHook(() => useRecipes()).result.current;
    expect(recipes.map((r) => r.id)).toEqual([...DEFAULT_RECIPES].sort((a, b) => a.sortOrder - b.sortOrder).map((r) => r.id));
    expect(renderHook(() => useRecipe('lemon')).result.current?.id).toBe('lemon');
    expect(renderHook(() => useRecipe('nope')).result.current).toBeUndefined();
    expect(renderHook(() => useRecipe(undefined)).result.current).toBeUndefined();
    const ingredients = renderHook(() => useIngredients()).result.current;
    expect(ingredients).toHaveLength(DEFAULT_INGREDIENTS.length);
    const names = ingredients.map((i) => i.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('serve live settings', async () => {
    const settings = renderHook(() => useSettings());
    await waitFor(() => expect(settings.result.current?.weightUnit).toBe(DEFAULT_SETTINGS.weightUnit));
    await updateSettings({ weightUnit: 'oz' });
    await waitFor(() => expect(settings.result.current?.weightUnit).toBe('oz'));
  });

  it('list batches newest first, optionally per recipe', async () => {
    await createBatch(batchInput('raw', 100));
    await createBatch(batchInput('lemon', 300));
    await createBatch(batchInput('raw', 200));
    const all = renderHook(() => useBatches());
    await waitFor(() => expect(all.result.current?.map((b) => b.madeAt)).toEqual([300, 200, 100]));
    const raw = renderHook(() => useBatches('raw'));
    await waitFor(() => expect(raw.result.current?.map((b) => b.madeAt)).toEqual([200, 100]));
  });
});
