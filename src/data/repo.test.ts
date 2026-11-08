import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_INGREDIENTS, DEFAULT_RECIPES, DEFAULT_SETTINGS } from '../calc/defaults';
import type { BatchLogEntry } from '../types';
import { db, requestPersistentStorage, SETTINGS_ID } from './db';
import { resetDb } from './fixtures';
import {
  createBatch,
  createIngredient,
  createRecipe,
  RepoError,
  deleteBatch,
  deleteIngredient,
  deleteRecipe,
  duplicateRecipe,
  getSettings,
  newId,
  setLastBatchSize,
  uniqueName,
  updateBatchNotes,
  updateBatchRating,
  updateIngredient,
  updateRecipe,
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
  it('seeds ingredients, recipes and settings on first open', async () => {
    expect(await db.ingredients.count()).toBe(DEFAULT_INGREDIENTS.length);
    expect((await db.recipes.toArray()).map((r) => r.id).sort()).toEqual(DEFAULT_RECIPES.map((r) => r.id).sort());
    const settings = await getSettings();
    expect(settings).toMatchObject({ ...DEFAULT_SETTINGS, id: SETTINGS_ID });
    expect(settings.updatedAt).toBeGreaterThan(0);
  });

  it('does not reseed an existing database', async () => {
    await db.recipes.clear();
    db.close();
    await db.open();
    expect(await db.recipes.count()).toBe(0);
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

describe('ids and names', () => {
  it('makes unique ids, with a fallback when randomUUID is missing', () => {
    expect(newId()).not.toBe(newId());
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
  });

  it('numbers name clashes ignoring case', () => {
    expect(uniqueName('Lemon', ['Raw'])).toBe('Lemon');
    expect(uniqueName('Lemon', ['lemon'])).toBe('Lemon (2)');
    expect(uniqueName('Lemon', ['Lemon', 'Lemon (2)'])).toBe('Lemon (3)');
  });
});

describe('ingredients', () => {
  it('creates and updates with updatedAt', async () => {
    const created = await createIngredient({
      name: 'Baking soda',
      group: 'base',
      packageGrams: 500,
      packagePrice: 3,
      minerals: { sodium: 0.27 },
    });
    expect(created.id).toBeTruthy();
    expect(created.updatedAt).toBeGreaterThan(0);
    await db.ingredients.update(created.id, { updatedAt: 1 });
    await updateIngredient(created.id, { packagePrice: 4 });
    const after = (await db.ingredients.get(created.id))!;
    expect(after.packagePrice).toBe(4);
    expect(after.updatedAt).toBeGreaterThan(1);
  });

  it('deletes an unused ingredient', async () => {
    const created = await createIngredient({ name: 'X', group: 'flavor', packageGrams: 1, packagePrice: 1, minerals: {} });
    await deleteIngredient(created.id);
    expect(await db.ingredients.get(created.id)).toBeUndefined();
  });

  it('refuses to delete an ingredient a recipe uses, naming the recipe', async () => {
    const error = await deleteIngredient('salt').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RepoError);
    expect((error as Error).message).toContain('Redmond Real Salt');
    expect((error as Error).message).toMatch(/Raw/);
    expect(await db.ingredients.get('salt')).toBeDefined();
  });

  it('refuses with a generic message when the ingredient row is gone', async () => {
    await db.recipes.clear();
    await db.recipes.add({
      id: 'tmp',
      name: 'Tmp',
      color: '#000',
      sortOrder: 0,
      lines: [{ ingredientId: 'ghost', gramsPerServing: 1 }],
      updatedAt: 1,
    });
    await expect(deleteIngredient('ghost')).rejects.toThrow(/This ingredient is used by "Tmp"\. Remove it from that recipe/);
  });
});

describe('recipes', () => {
  it('creates a recipe at the end of the list and rejects unknown ingredients', async () => {
    const recipe = await createRecipe({ name: 'Mine', color: '#123', lines: [{ ingredientId: 'salt', gramsPerServing: 2 }] });
    const max = Math.max(...DEFAULT_RECIPES.map((r) => r.sortOrder));
    expect(recipe.sortOrder).toBe(max + 1);
    await expect(
      createRecipe({ name: 'Bad', color: '#123', lines: [{ ingredientId: 'nope', gramsPerServing: 2 }] }),
    ).rejects.toThrow(RepoError);
    expect(await db.recipes.count()).toBe(DEFAULT_RECIPES.length + 1);
  });

  it('starts sortOrder at 0 when empty, and honours an explicit one', async () => {
    await db.recipes.clear();
    expect((await createRecipe({ name: 'A', color: '#1', lines: [] })).sortOrder).toBe(0);
    expect((await createRecipe({ name: 'B', color: '#1', lines: [], sortOrder: 7 })).sortOrder).toBe(7);
  });

  it('updates and stamps updatedAt, validating changed lines', async () => {
    await db.recipes.update('raw', { updatedAt: 1 });
    await updateRecipe('raw', { notes: 'hi' });
    const raw = (await db.recipes.get('raw'))!;
    expect(raw.notes).toBe('hi');
    expect(raw.updatedAt).toBeGreaterThan(1);
    await expect(updateRecipe('raw', { lines: [{ ingredientId: 'nope', gramsPerServing: 1 }] })).rejects.toThrow(RepoError);
  });

  it('duplicates as "Name (2)" and then "Name (3)", never built-in', async () => {
    const first = await duplicateRecipe('lemon');
    const second = await duplicateRecipe('lemon');
    expect(first.name).toMatch(/\(2\)$/);
    expect(second.name).toMatch(/\(3\)$/);
    expect(first.builtIn).toBe(false);
    expect(first.id).not.toBe('lemon');
    expect(first.lines).toEqual((await db.recipes.get('lemon'))!.lines);
    expect(second.sortOrder).toBeGreaterThan(first.sortOrder);
    await expect(duplicateRecipe('missing')).rejects.toThrow(RepoError);
  });

  it('deletes a recipe and its remembered batch size, and keeps logged batches', async () => {
    await setLastBatchSize('lemon', { mode: 'servings', servings: 12 });
    await setLastBatchSize('raw', { mode: 'vials', vials: 2 });
    await createBatch(batchInput('lemon', 1));
    await deleteRecipe('lemon');
    expect(await db.recipes.get('lemon')).toBeUndefined();
    expect((await getSettings()).lastBatchSize).toEqual({ raw: { mode: 'vials', vials: 2 } });
    expect(await db.batches.count()).toBe(1);
    await deleteRecipe('raw');
    await deleteRecipe('raw');
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

describe('hooks', () => {
  it('serve live data', async () => {
    const recipes = renderHook(() => useRecipes());
    await waitFor(() => expect(recipes.result.current).toHaveLength(DEFAULT_RECIPES.length));
    const sorted = recipes.result.current!.map((r) => r.sortOrder);
    expect(sorted).toEqual([...sorted].sort((a, b) => a - b));

    const one = renderHook(() => useRecipe('lemon'));
    await waitFor(() => expect(one.result.current?.id).toBe('lemon'));
    expect(renderHook(() => useRecipe(undefined)).result.current).toBeUndefined();

    const ingredients = renderHook(() => useIngredients());
    await waitFor(() => expect(ingredients.result.current).toHaveLength(DEFAULT_INGREDIENTS.length));
    const names = ingredients.result.current!.map((i) => i.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

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
