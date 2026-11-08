import Dexie, { type EntityTable } from 'dexie';
import { DEFAULT_INGREDIENTS, DEFAULT_RECIPES, DEFAULT_SETTINGS } from '../calc/defaults';
import type { BatchLogEntry, Ingredient, Recipe, Settings } from '../types';

export const SETTINGS_ID = 'settings';

/** The single settings row. `updatedAt` lets a merge restore pick the newer copy. */
export type SettingsRow = Settings & { id: typeof SETTINGS_ID; updatedAt: number };

/**
 * IndexedDB schema (REQUIREMENTS.md T5, T6). To change it, add a new
 * `version(n)` with an `upgrade()` migration; never edit an existing version.
 */
export class LmntDb extends Dexie {
  ingredients!: EntityTable<Ingredient, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  batches!: EntityTable<BatchLogEntry, 'id'>;
  settings!: EntityTable<SettingsRow, 'id'>;

  constructor(name = 'lmnt-calculator') {
    super(name);
    this.version(1).stores({
      ingredients: 'id',
      recipes: 'id, sortOrder',
      batches: 'id, madeAt, recipeId',
      settings: 'id',
    });
    // Runs once, when the database is first created.
    this.on('populate', (tx) => {
      const now = Date.now();
      tx.table('ingredients').bulkAdd(DEFAULT_INGREDIENTS.map((i) => ({ ...i, updatedAt: now })));
      tx.table('recipes').bulkAdd(DEFAULT_RECIPES.map((r) => ({ ...r, updatedAt: now })));
      tx.table('settings').add({ ...DEFAULT_SETTINGS, id: SETTINGS_ID, updatedAt: now });
    });
  }
}

export const db = new LmntDb();

/** Asks the browser not to evict our data under storage pressure (T5). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
