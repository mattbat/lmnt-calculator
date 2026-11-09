import Dexie, { type EntityTable } from 'dexie';
import { DEFAULT_SETTINGS } from '../calc/defaults';
import { dropVialsFromBatch, dropVialsFromSettings } from './legacy';
import type { BatchLogEntry, Settings } from '../types';

export const SETTINGS_ID = 'settings';

/** The single settings row. `updatedAt` lets a merge restore pick the newer copy. */
export type SettingsRow = Settings & { id: typeof SETTINGS_ID; updatedAt: number };

/**
 * IndexedDB schema (REQUIREMENTS.md T5, T6). To change it, add a new
 * `version(n)` with an `upgrade()` migration; never edit an existing version.
 */
export class LmntDb extends Dexie {
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
    // Recipes and ingredients are built into the app (src/calc/defaults.ts), so
    // they no longer live in the database. Batches and settings are kept as they are.
    this.version(2)
      .stores({ recipes: null, ingredients: null })
      .upgrade((tx) =>
        tx
          .table('settings')
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            delete row.showTeaspoons;
          }),
      );
    // Vials were dropped: one serving always fills one vial. Vial batch sizes
    // become servings, and the vial fields go from settings and the log.
    this.version(3)
      .stores({})
      .upgrade(async (tx) => {
        await tx.table('settings').toCollection().modify((row: Record<string, unknown>) => {
          dropVialsFromSettings(row);
        });
        await tx.table('batches').toCollection().modify((row: Record<string, unknown>) => {
          dropVialsFromBatch(row);
        });
      });
    // Runs once, when the database is first created.
    this.on('populate', (tx) => {
      tx.table('settings').add({ ...DEFAULT_SETTINGS, id: SETTINGS_ID, updatedAt: Date.now() });
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
