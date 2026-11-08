import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_INGREDIENTS, DEFAULT_RECIPES } from '../calc/defaults';
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

const SNOOZE_DAYS = 30;

/** "Not now" on the backup reminder: hides it for 30 days. */
export async function snoozeBackupReminder(now = Date.now()): Promise<void> {
  await updateSettings({ backupReminderSnoozedUntil: now + SNOOZE_DAYS * 24 * 60 * 60 * 1000 });
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

/** Built-in recipes, sorted for the Recipes list. They come from code, so every update ships new values. */
const RECIPES: Recipe[] = [...DEFAULT_RECIPES].sort((a, b) => a.sortOrder - b.sortOrder);
const INGREDIENTS: Ingredient[] = [...DEFAULT_INGREDIENTS].sort((a, b) => a.name.localeCompare(b.name));

export function useRecipes(): Recipe[] {
  return RECIPES;
}

/** The built-in recipe with this id, or undefined when there isn't one. */
export function useRecipe(id: string | undefined): Recipe | undefined {
  return id ? RECIPES.find((r) => r.id === id) : undefined;
}

export function useIngredients(): Ingredient[] {
  return INGREDIENTS;
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
