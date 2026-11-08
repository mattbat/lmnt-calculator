import { db, SETTINGS_ID, type SettingsRow } from './db';
import { shareFile, type ShareOutcome } from './share';
import type { BatchLogEntry, Ingredient, Recipe, Settings } from '../types';

/** The backup file layout version (B4). Bump it, and add a step to `MIGRATIONS`, when the layout changes. */
export const BACKUP_FORMAT = 1;
export const APP_ID = 'lmnt-calculator';
const REMINDER_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Backup {
  app: typeof APP_ID;
  format: number;
  exportedAt: number;
  ingredients: Ingredient[];
  recipes: Recipe[];
  batches: BatchLogEntry[];
  settings: SettingsRow;
}

/**
 * Upgrades an older backup, one format at a time. `MIGRATIONS[n]` turns a
 * format-n file into a format-(n+1) file. Empty until format 2 exists (B4).
 */
export const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

export async function createBackup(now = Date.now()): Promise<Backup> {
  const [ingredients, recipes, batches, settings] = await Promise.all([
    db.ingredients.toArray(),
    db.recipes.toArray(),
    db.batches.toArray(),
    db.settings.get(SETTINGS_ID),
  ]);
  if (!settings) throw new Error('Settings are missing.');
  return { app: APP_ID, format: BACKUP_FORMAT, exportedAt: now, ingredients, recipes, batches, settings };
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `lmnt-calculator-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

// Validation. Strict on shape, so a damaged file can't poison the database.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const optNum = (v: unknown) => v === undefined || isNum(v);
const optStr = (v: unknown) => v === undefined || isStr(v);

function fail(what: string): never {
  throw new Error(`The backup file is damaged (${what}).`);
}

function checkIngredient(v: unknown, i: number): void {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.name) || !isNum(v.packageGrams) || !isNum(v.packagePrice) || !isNum(v.updatedAt)) {
    fail(`ingredient ${i + 1}`);
  }
  if ((v.group !== 'base' && v.group !== 'flavor') || !optStr(v.buyUrl) || !optNum(v.gramsPerTsp) || !isObj(v.minerals)) {
    fail(`ingredient ${i + 1}`);
  }
  for (const f of Object.values(v.minerals)) if (!isNum(f)) fail(`ingredient ${i + 1} minerals`);
}

function checkLines(lines: unknown, what: string): void {
  if (!Array.isArray(lines)) fail(what);
  for (const l of lines) {
    if (!isObj(l) || !isStr(l.ingredientId) || !isNum(l.gramsPerServing)) fail(what);
  }
}

function checkRecipe(v: unknown, i: number): void {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.name) || !isStr(v.color) || !isNum(v.sortOrder) || !isNum(v.updatedAt)) {
    fail(`recipe ${i + 1}`);
  }
  if (!optStr(v.notes) || (v.builtIn !== undefined && typeof v.builtIn !== 'boolean')) fail(`recipe ${i + 1}`);
  checkLines(v.lines, `recipe ${i + 1} ingredients`);
}

function checkBatch(v: unknown, i: number): void {
  const what = `log entry ${i + 1}`;
  if (!isObj(v) || !isStr(v.id) || !isNum(v.madeAt) || !isStr(v.recipeId) || !isNum(v.updatedAt)) fail(what);
  if (!isNum(v.servings) || !isNum(v.vials) || !isNum(v.servingsPerVial) || !isNum(v.fillGramsPerVial)) fail(what);
  if (!isNum(v.totalCost) || !isStr(v.notes) || !optNum(v.rating)) fail(what);
  if (!isObj(v.recipeSnapshot) || !isStr(v.recipeSnapshot.name) || !isStr(v.recipeSnapshot.color)) fail(what);
  checkLines(v.recipeSnapshot.lines, what);
  if (!Array.isArray(v.lines)) fail(what);
  for (const l of v.lines) {
    if (!isObj(l) || !isStr(l.ingredientId) || !isStr(l.name) || !isNum(l.gramsPerServing) || !isNum(l.targetGrams) || !optNum(l.actualGrams)) {
      fail(what);
    }
  }
}

function checkSettings(v: unknown): void {
  if (!isObj(v) || v.id !== SETTINGS_ID || !isNum(v.updatedAt)) fail('settings');
  const numbers = ['retailPricePerServing', 'servingsPerVial', 'defaultServings'];
  if (numbers.some((k) => !isNum(v[k])) || !optNum(v.disclaimerAcceptedAt) || !optNum(v.lastBackupAt)) fail('settings');
  if (![0.01, 0.1, 1].includes(v.scalePrecision as number)) fail('settings');
  if (v.weightUnit !== 'g' && v.weightUnit !== 'oz') fail('settings');
  if (typeof v.showTeaspoons !== 'boolean') fail('settings');
  if (v.theme !== 'system' && v.theme !== 'light' && v.theme !== 'dark') fail('settings');
  if (!isObj(v.lastBatchSize)) fail('settings');
}

/**
 * Reads a backup file's text. Never throws: returns a friendly error for
 * non-JSON, other apps' files, files from a newer app, and damaged files.
 */
export function parseBackup(text: string, currentFormat = BACKUP_FORMAT): ParseResult {
  try {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, error: "This isn't a backup file. It couldn't be read as JSON." };
    }
    if (!isObj(raw) || raw.app !== APP_ID) {
      return { ok: false, error: "This file isn't an LMNT Calculator backup." };
    }
    if (!Number.isInteger(raw.format) || (raw.format as number) < 1) {
      return { ok: false, error: 'This backup has no valid format version.' };
    }
    if ((raw.format as number) > currentFormat) {
      return { ok: false, error: 'This backup was made by a newer version of the app. Update the app and try again.' };
    }
    let current: Obj = raw;
    for (let format = raw.format as number; format < currentFormat; format++) {
      const step = MIGRATIONS[format];
      if (!step) return { ok: false, error: `This backup is too old to restore (format ${format}).` };
      current = { ...step(current), format: format + 1 };
    }
    if (!isNum(current.exportedAt)) fail('date');
    for (const key of ['ingredients', 'recipes', 'batches'] as const) {
      if (!Array.isArray(current[key])) fail(key);
    }
    (current.ingredients as unknown[]).forEach(checkIngredient);
    (current.recipes as unknown[]).forEach(checkRecipe);
    (current.batches as unknown[]).forEach(checkBatch);
    checkSettings(current.settings);
    for (const key of ['ingredients', 'recipes', 'batches'] as const) {
      const ids = (current[key] as Obj[]).map((r) => r.id);
      if (new Set(ids).size !== ids.length) fail(`duplicate ${key}`);
    }
    return { ok: true, backup: current as unknown as Backup };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'The backup file could not be read.' };
  }
}

// Restore

export type RestoreMode = 'replace' | 'merge';

export interface TableCounts {
  ingredients: number;
  recipes: number;
  batches: number;
}

export interface BackupSummary {
  exportedAt: number;
  /** What the file holds. */
  inFile: TableCounts;
  /** What is on the device now. */
  onDevice: TableCounts;
  /** What a merge would do. */
  merge: { added: TableCounts; updated: TableCounts; unchanged: TableCounts };
}

const zero = (): TableCounts => ({ ingredients: 0, recipes: 0, batches: 0 });

/** The preview shown before a restore is confirmed (B2). */
export async function summarizeBackup(backup: Backup): Promise<BackupSummary> {
  const summary: BackupSummary = {
    exportedAt: backup.exportedAt,
    inFile: {
      ingredients: backup.ingredients.length,
      recipes: backup.recipes.length,
      batches: backup.batches.length,
    },
    onDevice: {
      ingredients: await db.ingredients.count(),
      recipes: await db.recipes.count(),
      batches: await db.batches.count(),
    },
    merge: { added: zero(), updated: zero(), unchanged: zero() },
  };
  for (const key of ['ingredients', 'recipes', 'batches'] as const) {
    const local = new Map<string, number>(
      ((await db[key].toArray()) as Array<{ id: string; updatedAt: number }>).map((r) => [r.id, r.updatedAt]),
    );
    for (const incoming of backup[key]) {
      const existing = local.get(incoming.id);
      if (existing === undefined) summary.merge.added[key]++;
      else if (incoming.updatedAt > existing) summary.merge.updated[key]++;
      else summary.merge.unchanged[key]++;
    }
  }
  return summary;
}

function newer<T extends { id: string; updatedAt: number }>(incoming: T[], local: T[]): T[] {
  const byId = new Map(local.map((r) => [r.id, r]));
  return incoming.filter((r) => {
    const existing = byId.get(r.id);
    return !existing || r.updatedAt > existing.updatedAt;
  });
}

/** Applies a validated backup. 'replace' wipes everything first; 'merge' keeps the newer copy of each id. */
export async function restoreBackup(backup: Backup, mode: RestoreMode): Promise<void> {
  await db.transaction('rw', [db.ingredients, db.recipes, db.batches, db.settings], async () => {
    if (mode === 'replace') {
      await Promise.all([db.ingredients.clear(), db.recipes.clear(), db.batches.clear(), db.settings.clear()]);
      await db.ingredients.bulkAdd(backup.ingredients);
      await db.recipes.bulkAdd(backup.recipes);
      await db.batches.bulkAdd(backup.batches);
      await db.settings.add(backup.settings);
      return;
    }
    await db.ingredients.bulkPut(newer(backup.ingredients, await db.ingredients.toArray()));
    await db.recipes.bulkPut(newer(backup.recipes, await db.recipes.toArray()));
    await db.batches.bulkPut(newer(backup.batches, await db.batches.toArray()));
    const local = await db.settings.get(SETTINGS_ID);
    if (!local || backup.settings.updatedAt > local.updatedAt) await db.settings.put(backup.settings);
  });
}

// Backing up

/**
 * Exports everything through the share sheet (or a download) and, unless the
 * user cancelled, records the time so the reminder resets (B1, B3).
 */
export async function backupNow(now = Date.now()): Promise<ShareOutcome> {
  const backup = await createBackup(now);
  backup.settings = { ...backup.settings, lastBackupAt: now };
  const outcome = await shareFile(backupFileName(new Date(now)), JSON.stringify(backup, null, 2));
  if (outcome !== 'cancelled') await db.settings.update(SETTINGS_ID, { lastBackupAt: now });
  return outcome;
}

/** B3: the log has entries and no backup has been made in 60 days. */
export function needsBackupReminder(settings: Pick<Settings, 'lastBackupAt'>, batchCount: number, now = Date.now()): boolean {
  if (batchCount === 0) return false;
  return settings.lastBackupAt === undefined || now - settings.lastBackupAt > REMINDER_DAYS * DAY_MS;
}
