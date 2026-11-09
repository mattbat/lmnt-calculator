import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { LmntDb, SETTINGS_ID } from './db';
import { DEFAULT_INGREDIENTS, DEFAULT_RECIPES, DEFAULT_SETTINGS } from '../calc/defaults';

describe('Dexie version 2 migration', () => {
  it('keeps batches and settings from a real v1 database and drops recipes and ingredients', async () => {
    const name = `lmnt-migration-${Date.now()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({
      ingredients: 'id',
      recipes: 'id, sortOrder',
      batches: 'id, madeAt, recipeId',
      settings: 'id',
    });
    const batch = {
      id: 'b1',
      madeAt: 1000,
      recipeId: 'raw',
      recipeSnapshot: { name: 'Raw', color: '#fff', lines: [{ ingredientId: 'salt', gramsPerServing: 2.5 }] },
      servings: 30,
      vials: 30,
      servingsPerVial: 1,
      fillGramsPerVial: 3.275,
      lines: [{ ingredientId: 'salt', name: 'Salt', gramsPerServing: 2.5, targetGrams: 75, actualGrams: 75.1 }],
      totalCost: 3,
      notes: 'ok',
      rating: 4,
      updatedAt: 1001,
    };
    const settings = {
      ...DEFAULT_SETTINGS,
      id: SETTINGS_ID,
      showTeaspoons: true,
      weightUnit: 'oz',
      disclaimerAcceptedAt: 5,
      lastBackupAt: 6,
      lastBatchSize: { raw: { mode: 'servings', servings: 12 } },
      servingsPerVial: 1,
      updatedAt: 7,
    };
    await v1.table('ingredients').bulkAdd(DEFAULT_INGREDIENTS);
    await v1.table('recipes').bulkAdd(DEFAULT_RECIPES);
    await v1.table('batches').add(batch);
    await v1.table('settings').add(settings);
    v1.close();

    const db = new LmntDb(name);
    try {
      await db.open();
      expect(db.tables.map((t) => t.name).sort()).toEqual(['batches', 'settings']);
      expect(db.backendDB().objectStoreNames.contains('recipes')).toBe(false);
      expect(db.backendDB().objectStoreNames.contains('ingredients')).toBe(false);
      const { vials: _v, servingsPerVial: _spv, fillGramsPerVial: _fill, ...keptBatch } = batch;
      void [_v, _spv, _fill];
      expect(await db.batches.toArray()).toEqual([keptBatch]);
      const { showTeaspoons: _removed, servingsPerVial: _spvSetting, ...expected } = settings;
      void [_removed, _spvSetting];
      const row = await db.settings.get(SETTINGS_ID);
      expect(row).toEqual(expected);
      expect(row).not.toHaveProperty('showTeaspoons');
    } finally {
      db.close();
      await Dexie.delete(name);
    }
  });

  it('version 3 turns vial batch sizes into servings and drops the vial fields', async () => {
    const name = `lmnt-vials-${Date.now()}`;
    const v2 = new Dexie(name);
    v2.version(2).stores({ batches: 'id, madeAt, recipeId', settings: 'id' });
    await v2.table('settings').add({
      ...DEFAULT_SETTINGS,
      id: SETTINGS_ID,
      servingsPerVial: 3,
      lastBatchSize: { raw: { mode: 'vials', vials: 4 }, lemon: { mode: 'servings', servings: 9 }, junk: 'x' },
      updatedAt: 7,
    });
    await v2.table('batches').add({
      id: 'b1',
      madeAt: 1,
      recipeId: 'raw',
      recipeSnapshot: { name: 'Raw', color: '#fff', lines: [] },
      servings: 12,
      vials: 4,
      servingsPerVial: 3,
      fillGramsPerVial: 9.8,
      lines: [],
      totalCost: 1,
      notes: '',
      updatedAt: 2,
    });
    v2.close();

    const db = new LmntDb(name);
    try {
      await db.open();
      const row = await db.settings.get(SETTINGS_ID);
      expect(row).not.toHaveProperty('servingsPerVial');
      expect(row!.lastBatchSize).toEqual({ raw: { mode: 'servings', servings: 12 }, lemon: { mode: 'servings', servings: 9 } });
      const b = await db.batches.get('b1');
      expect(b).toMatchObject({ servings: 12 });
      for (const key of ['vials', 'servingsPerVial', 'fillGramsPerVial']) expect(b).not.toHaveProperty(key);
    } finally {
      db.close();
      await Dexie.delete(name);
    }
  });

  it('seeds only the settings row in a brand-new database', async () => {
    const name = `lmnt-fresh-${Date.now()}`;
    const db = new LmntDb(name);
    try {
      await db.open();
      expect(db.tables.map((t) => t.name).sort()).toEqual(['batches', 'settings']);
      expect(await db.settings.get(SETTINGS_ID)).toMatchObject({ ...DEFAULT_SETTINGS, id: SETTINGS_ID });
      expect(await db.batches.count()).toBe(0);
    } finally {
      db.close();
      await Dexie.delete(name);
    }
  });
});
