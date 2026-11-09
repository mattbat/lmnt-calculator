import { normalizeBatchSize } from '../calc/batch';

type Row = Record<string, unknown>;

/**
 * Upgrades rows saved before vials were dropped (2026-11-09). One serving now
 * always fills one vial, so batch sizes given in vials become servings, and
 * the vial fields go. Used by the Dexie version 3 migration and by the
 * backup format 2 to 3 migration. Changes the row in place and returns it.
 */
export function dropVialsFromSettings(row: Row): Row {
  const spv = typeof row.servingsPerVial === 'number' ? row.servingsPerVial : 1;
  delete row.servingsPerVial;
  const sizes = row.lastBatchSize;
  if (typeof sizes === 'object' && sizes !== null && !Array.isArray(sizes)) {
    const next: Row = {};
    for (const [id, size] of Object.entries(sizes as Row)) {
      const normal = normalizeBatchSize(size, spv);
      if (normal) next[id] = normal;
    }
    row.lastBatchSize = next;
  }
  return row;
}

export function dropVialsFromBatch(row: Row): Row {
  delete row.vials;
  delete row.servingsPerVial;
  delete row.fillGramsPerVial;
  return row;
}
