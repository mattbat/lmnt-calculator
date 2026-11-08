import { useLiveQuery } from 'dexie-react-hooks';
import { db, SETTINGS_ID, type SettingsRow } from './db';
import type { BatchLogEntry, BatchSize, Ingredient, Recipe, Settings } from '../types';

/**
 * The only module that writes storage. Screens call these functions (and the
 * hooks at the bottom) instead of touching Dexie directly.
 */

/** A random v4 UUID, with a fallback for pages where `randomUUID` is missing (plain http). */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Thrown when a write would leave a dangling reference. The message is fit to show the user. */
export class RepoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepoError';
  }
}

/** "Lemon" -> "Lemon (2)", then "Lemon (3)"...: the first name not in `taken` (case-insensitive). */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((n) => n.trim().toLowerCase()));
  if (!used.has(name.trim().toLowerCase())) return name;
  for (let n = 2; ; n++) {
    const candidate = `${name} (${n})`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

// Ingredients

export type IngredientInput = Omit<Ingredient, 'id' | 'updatedAt'>;

export async function createIngredient(input: IngredientInput): Promise<Ingredient> {
  const ingredient: Ingredient = { ...input, id: newId(), updatedAt: Date.now() };
  await db.ingredients.add(ingredient);
  return ingredient;
}

export async function updateIngredient(id: string, changes: Partial<Omit<Ingredient, 'id'>>): Promise<void> {
  await db.ingredients.update(id, { ...changes, updatedAt: Date.now() });
}

/** Refuses to delete an ingredient a recipe still uses, so no recipe is left with a missing line. */
export async function deleteIngredient(id: string): Promise<void> {
  await db.transaction('rw', db.ingredients, db.recipes, async () => {
    const users = (await db.recipes.toArray()).filter((r) => r.lines.some((l) => l.ingredientId === id));
    if (users.length > 0) {
      const ingredient = await db.ingredients.get(id);
      const names = users.map((r) => `"${r.name}"`).join(', ');
      throw new RepoError(
        `${ingredient ? `"${ingredient.name}"` : 'This ingredient'} is used by ${names}. Remove it from ${users.length === 1 ? 'that recipe' : 'those recipes'} first.`,
      );
    }
    await db.ingredients.delete(id);
  });
}

// Recipes

export type RecipeInput = Omit<Recipe, 'id' | 'updatedAt' | 'sortOrder' | 'builtIn'> & { sortOrder?: number };

async function assertIngredientsExist(recipe: Pick<Recipe, 'lines'>): Promise<void> {
  const ids = [...new Set(recipe.lines.map((l) => l.ingredientId))];
  const found = await db.ingredients.bulkGet(ids);
  if (found.some((i) => !i)) throw new RepoError('This recipe uses an ingredient that no longer exists.');
}

async function nextSortOrder(): Promise<number> {
  const last = await db.recipes.orderBy('sortOrder').last();
  return last ? last.sortOrder + 1 : 0;
}

export async function createRecipe(input: RecipeInput): Promise<Recipe> {
  return db.transaction('rw', db.recipes, db.ingredients, async () => {
    await assertIngredientsExist(input);
    const recipe: Recipe = {
      ...input,
      id: newId(),
      sortOrder: input.sortOrder ?? (await nextSortOrder()),
      updatedAt: Date.now(),
    };
    await db.recipes.add(recipe);
    return recipe;
  });
}

export async function updateRecipe(id: string, changes: Partial<Omit<Recipe, 'id'>>): Promise<void> {
  await db.transaction('rw', db.recipes, db.ingredients, async () => {
    if (changes.lines) await assertIngredientsExist({ lines: changes.lines });
    await db.recipes.update(id, { ...changes, updatedAt: Date.now() });
  });
}

/** Copies a recipe as "Name (2)". The copy is never built-in. */
export async function duplicateRecipe(id: string): Promise<Recipe> {
  return db.transaction('rw', db.recipes, async () => {
    const source = await db.recipes.get(id);
    if (!source) throw new RepoError('That recipe no longer exists.');
    const all = await db.recipes.toArray();
    const copy: Recipe = {
      ...source,
      lines: source.lines.map((l) => ({ ...l })),
      id: newId(),
      name: uniqueName(
        source.name,
        all.map((r) => r.name),
      ),
      sortOrder: all.reduce((max, r) => Math.max(max, r.sortOrder), -1) + 1,
      builtIn: false,
      updatedAt: Date.now(),
    };
    await db.recipes.add(copy);
    return copy;
  });
}

/** Deletes a recipe. Logged batches keep their own snapshot, so the log is untouched. */
export async function deleteRecipe(id: string): Promise<void> {
  await db.transaction('rw', db.recipes, db.settings, async () => {
    await db.recipes.delete(id);
    const row = await db.settings.get(SETTINGS_ID);
    if (row && id in row.lastBatchSize) {
      const lastBatchSize = { ...row.lastBatchSize };
      delete lastBatchSize[id];
      await db.settings.update(SETTINGS_ID, { lastBatchSize, updatedAt: Date.now() });
    }
  });
}

// Batches

export type BatchInput = Omit<BatchLogEntry, 'id' | 'updatedAt'>;

export async function createBatch(input: BatchInput): Promise<BatchLogEntry> {
  const batch: BatchLogEntry = { ...input, id: newId(), updatedAt: Date.now() };
  await db.batches.add(batch);
  return batch;
}

export async function updateBatch(id: string, changes: Partial<Omit<BatchLogEntry, 'id'>>): Promise<void> {
  await db.batches.update(id, { ...changes, updatedAt: Date.now() });
}

export async function updateBatchNotes(id: string, notes: string): Promise<void> {
  await updateBatch(id, { notes });
}

/** Sets the 1-5 rating (L6), or clears it with `undefined`. */
export async function updateBatchRating(id: string, rating: number | undefined): Promise<void> {
  if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new RepoError('A rating is a whole number from 1 to 5.');
  }
  await db.transaction('rw', db.batches, async () => {
    const batch = await db.batches.get(id);
    if (!batch) return;
    const next = { ...batch, rating, updatedAt: Date.now() };
    if (rating === undefined) delete next.rating;
    await db.batches.put(next);
  });
}

export async function deleteBatch(id: string): Promise<void> {
  await db.batches.delete(id);
}

// Settings

export async function getSettings(): Promise<SettingsRow> {
  const row = await db.settings.get(SETTINGS_ID);
  if (!row) throw new RepoError('Settings are missing.');
  return row;
}

export async function updateSettings(changes: Partial<Settings>): Promise<void> {
  await db.settings.update(SETTINGS_ID, { ...changes, updatedAt: Date.now() });
}

/** Remembers the last batch size used for a recipe (C8). */
export async function setLastBatchSize(recipeId: string, size: BatchSize): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const row = await getSettings();
    await db.settings.update(SETTINGS_ID, {
      lastBatchSize: { ...row.lastBatchSize, [recipeId]: size },
      updatedAt: Date.now(),
    });
  });
}

// React hooks. Each returns undefined while loading.

export function useRecipes(): Recipe[] | undefined {
  return useLiveQuery(() => db.recipes.orderBy('sortOrder').toArray(), []);
}

export function useRecipe(id: string | undefined): Recipe | undefined {
  return useLiveQuery(() => (id ? db.recipes.get(id) : undefined), [id]);
}

export function useIngredients(): Ingredient[] | undefined {
  return useLiveQuery(async () => (await db.ingredients.toArray()).sort((a, b) => a.name.localeCompare(b.name)), []);
}

/** Batches newest first, optionally only one recipe's (L2). */
export function useBatches(recipeId?: string): BatchLogEntry[] | undefined {
  return useLiveQuery(
    () =>
      recipeId
        ? db.batches.where('recipeId').equals(recipeId).reverse().sortBy('madeAt')
        : db.batches.orderBy('madeAt').reverse().toArray(),
    [recipeId],
  );
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get(SETTINGS_ID), []);
}
