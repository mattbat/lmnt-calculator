import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BatchLogEntry } from '../types';
import {
  APP_ID,
  BACKUP_FORMAT,
  MIGRATIONS,
  backupFileName,
  backupNow,
  createBackup,
  needsBackupReminder,
  parseBackup,
  restoreBackup,
  summarizeBackup,
} from './backup';
import { db, SETTINGS_ID } from './db';
import { resetDb } from './fixtures';
import { createBatch, getSettings, updateSettings } from './repo';
import * as share from './share';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

beforeEach(resetDb);
afterEach(() => vi.restoreAllMocks());

const batch: Omit<BatchLogEntry, 'id' | 'updatedAt'> = {
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
  rating: 5,
};

async function snapshot() {
  return {
    batches: await db.batches.orderBy('id').toArray(),
    settings: await db.settings.toArray(),
  };
}

describe('createBackup and parseBackup (B1)', () => {
  it('exports everything with a version and parses it back unchanged', async () => {
    await createBatch(batch);
    const backup = await createBackup(5);
    expect(backup).toMatchObject({ app: APP_ID, format: BACKUP_FORMAT, exportedAt: 5 });
    expect(backup.batches).toHaveLength(1);
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed).toEqual({ ok: true, backup });
  });

  it('fails clearly when settings are missing', async () => {
    await db.settings.clear();
    await expect(createBackup()).rejects.toThrow(/Settings/);
  });

  it('names the file by local date', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('lmnt-calculator-backup-2026-01-05.json');
  });
});

describe('rejecting bad files (B2, B4)', () => {
  it('rejects non-JSON, other apps, and bad or newer formats', async () => {
    const good = await createBackup();
    const error = (text: string) => {
      const result = parseBackup(text);
      return result.ok ? '' : result.error;
    };
    expect(error('not json {')).toMatch(/isn't a backup/);
    expect(error('[1,2]')).toMatch(/isn't an LMNT Calculator backup/);
    expect(error(JSON.stringify({ ...good, app: 'next5' }))).toMatch(/isn't an LMNT Calculator backup/);
    expect(error(JSON.stringify({ ...good, format: 'x' }))).toMatch(/no valid format/);
    expect(error(JSON.stringify({ ...good, format: 0 }))).toMatch(/no valid format/);
    expect(error(JSON.stringify({ ...good, format: BACKUP_FORMAT + 1 }))).toMatch(/newer version/);
  });

  it('rejects damaged contents with a friendly message', async () => {
    await createBatch(batch);
    const good = JSON.parse(JSON.stringify(await createBackup())) as Loose;
    const mutate = (fn: (b: Loose) => void) => {
      const copy = structuredClone(good);
      fn(copy);
      const result = parseBackup(JSON.stringify(copy));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/damaged/);
    };
    mutate((b) => delete b.exportedAt);
    mutate((b) => (b.batches = 'nope'));
    mutate((b) => delete b.batches);
    mutate((b) => (b.batches[0].recipeSnapshot.lines = [{ ingredientId: 1 }]));
    mutate((b) => (b.batches[0].recipeSnapshot.lines = 'x'));
    mutate((b) => (b.batches[0].servings = null));
    mutate((b) => (b.batches[0].recipeSnapshot = {}));
    mutate((b) => (b.batches[0].lines = [{}]));
    mutate((b) => (b.batches[0].lines = 'x'));
    mutate((b) => (b.settings.theme = 'neon'));
    mutate((b) => (b.settings.scalePrecision = 5));
    mutate((b) => (b.settings.weightUnit = 'lb'));
    mutate((b) => (b.settings.backupReminderSnoozedUntil = 'soon'));
    mutate((b) => (b.settings.lastBatchSize = []));
    mutate((b) => (b.settings.defaultServings = 'x'));
    mutate((b) => (b.settings.id = 'other'));
    mutate((b) => (b.settings = null));
    mutate((b) => b.batches.push({ ...b.batches[0] }));
  });

  it('migrates old formats step by step, or refuses when no step exists (B4)', async () => {
    const text = JSON.stringify(await createBackup());
    // Pretend the app is at format 3 and a step for format 2 exists.
    const step = vi.fn((raw: Record<string, unknown>) => ({ ...raw, extra: 1 }));
    MIGRATIONS[2] = step;
    try {
      const result = parseBackup(text, 3);
      expect(step).toHaveBeenCalledOnce();
      expect(result.ok && result.backup.format).toBe(3);
    } finally {
      delete MIGRATIONS[2];
    }
    const refused = parseBackup(text, 3);
    expect(!refused.ok && refused.error).toMatch(/too old/);
  });

  it('restores a format 1 file, ignoring its recipes and ingredients', async () => {
    await createBatch(batch);
    const current = await createBackup(7);
    const v1 = {
      ...current,
      format: 1,
      ingredients: [{ id: 'salt', name: 'Salt', group: 'base' }],
      recipes: [{ id: 'mine', name: 'Mine' }],
      settings: { ...current.settings, showTeaspoons: true },
    };
    const parsed = parseBackup(JSON.stringify(v1));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.format).toBe(2);
    expect(parsed.backup).not.toHaveProperty('recipes');
    expect(parsed.backup).not.toHaveProperty('ingredients');
    expect(parsed.backup.settings).not.toHaveProperty('showTeaspoons');
    expect(parsed.backup.batches).toHaveLength(1);

    await db.batches.clear();
    await updateSettings({ weightUnit: 'oz' });
    await restoreBackup(parsed.backup, 'replace');
    expect(await db.batches.count()).toBe(1);
    expect((await getSettings()).weightUnit).toBe(current.settings.weightUnit);
    expect(db.tables.map((t) => t.name).sort()).toEqual(['batches', 'settings']);
  });
});

describe('restoreBackup (B2)', () => {
  it('replace wipes the device and restores the file exactly', async () => {
    await createBatch(batch);
    const backup = await createBackup();
    const before = await snapshot();
    await db.batches.clear();
    await updateSettings({ weightUnit: 'oz' });
    await restoreBackup(backup, 'replace');
    expect(await snapshot()).toEqual(before);
  });

  it('replace also works from an empty database', async () => {
    await createBatch(batch);
    const backup = await createBackup();
    await Promise.all([db.batches.clear(), db.settings.clear()]);
    await restoreBackup(backup, 'replace');
    expect(await db.batches.count()).toBe(1);
    expect((await getSettings()).id).toBe(SETTINGS_ID);
  });

  it('merge keeps the newer copy of each id and adds missing items', async () => {
    const mine = await createBatch({ ...batch, notes: 'local' });
    const backup = await createBackup();
    // The file has an older copy of the device's batch, a batch the device lacks, and older settings.
    backup.batches = [
      { ...mine, notes: 'from file', updatedAt: 1 },
      { ...batch, id: 'b1', updatedAt: 5 },
    ];
    backup.settings.weightUnit = 'oz';
    backup.settings.updatedAt = 1;

    await restoreBackup(backup, 'merge');

    expect((await db.batches.get(mine.id))!.notes).toBe('local');
    expect(await db.batches.get('b1')).toBeDefined();
    expect((await getSettings()).weightUnit).not.toBe('oz');
  });

  it('merge takes newer settings, and settings when the device has none', async () => {
    const backup = await createBackup();
    backup.settings.weightUnit = 'oz';
    backup.settings.updatedAt = 9_999_999_999_999;
    await restoreBackup(backup, 'merge');
    expect((await getSettings()).weightUnit).toBe('oz');
    await db.settings.clear();
    await restoreBackup(backup, 'merge');
    expect((await getSettings()).weightUnit).toBe('oz');
  });
});

describe('summarizeBackup (B2)', () => {
  it('reports file, device and merge counts', async () => {
    const mine = await createBatch(batch);
    const old = await createBatch({ ...batch, madeAt: 2 });
    const backup = await createBackup(42);
    backup.batches = [{ ...mine, updatedAt: mine.updatedAt + 1000 }, old, { ...batch, id: 'b', updatedAt: 1 }];
    const summary = await summarizeBackup(backup);
    expect(summary.exportedAt).toBe(42);
    expect(summary.inFile).toEqual({ batches: 3 });
    expect(summary.onDevice).toEqual({ batches: 2 });
    expect(summary.merge.added).toEqual({ batches: 1 });
    expect(summary.merge.updated).toEqual({ batches: 1 });
    expect(summary.merge.unchanged).toEqual({ batches: 1 });
  });
});

describe('backupNow and the reminder (B1, B3)', () => {
  it('shares a dated file and records lastBackupAt', async () => {
    const spy = vi.spyOn(share, 'shareFile').mockResolvedValue('shared');
    const now = new Date(2026, 5, 1, 12).getTime();
    expect(await backupNow(now)).toBe('shared');
    const [name, text] = spy.mock.calls[0]!;
    expect(name).toBe('lmnt-calculator-backup-2026-06-01.json');
    const parsed = parseBackup(text);
    expect(parsed.ok && parsed.backup.settings.lastBackupAt).toBe(now);
    expect((await getSettings()).lastBackupAt).toBe(now);
  });

  it('does not record a backup the user cancelled', async () => {
    vi.spyOn(share, 'shareFile').mockResolvedValue('cancelled');
    expect(await backupNow()).toBe('cancelled');
    expect((await getSettings()).lastBackupAt).toBeUndefined();
  });

  it('reminds only when batches exist and the last backup is over 60 days old', () => {
    const day = 24 * 60 * 60 * 1000;
    const now = 100 * day;
    expect(needsBackupReminder({}, 0, now)).toBe(false);
    expect(needsBackupReminder({}, 3, now)).toBe(true);
    expect(needsBackupReminder({ lastBackupAt: now - 59 * day }, 3, now)).toBe(false);
    expect(needsBackupReminder({ lastBackupAt: now - 61 * day }, 3, now)).toBe(true);
    expect(needsBackupReminder({ lastBackupAt: now - 61 * day }, 0, now)).toBe(false);
  });

  it('stays quiet while snoozed, and returns afterwards', () => {
    const day = 24 * 60 * 60 * 1000;
    const now = 100 * day;
    expect(needsBackupReminder({ backupReminderSnoozedUntil: now + 1 }, 3, now)).toBe(false);
    expect(needsBackupReminder({ backupReminderSnoozedUntil: now }, 3, now)).toBe(true);
    expect(needsBackupReminder({ backupReminderSnoozedUntil: now - 1 }, 3, now)).toBe(true);
  });
});
