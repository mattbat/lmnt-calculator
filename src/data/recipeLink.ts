import { db } from './db';
import { createIngredient, createRecipe, uniqueName, updateRecipe } from './repo';
import type { Ingredient, IngredientGroup, MineralFractions, Recipe } from '../types';

/**
 * Shareable recipe links (SH1, SH5): `<app url>#r=<payload>`. The payload is
 * `<version><flag><base64url>`. Flag `z` means the JSON is deflate-compressed,
 * `p` means plain (used where CompressionStream is missing). The fragment
 * never reaches a server. Prices and buy links are left out.
 */

export const LINK_VERSION = '1';
const MAX_JSON_BYTES = 100_000;

export interface SharedIngredient {
  name: string;
  group: IngredientGroup;
  minerals: MineralFractions;
  gramsPerTsp?: number;
}

export interface SharedRecipe {
  name: string;
  color: string;
  notes?: string;
  lines: Array<{ ingredient: SharedIngredient; gramsPerServing: number }>;
}

export type DecodeResult = { ok: true; recipe: SharedRecipe } | { ok: false; error: string };

const MINERAL_ORDER = ['sodium', 'potassium', 'magnesium'] as const;

/** The compact wire shape: short keys, ingredients listed once and referenced by index. */
interface Wire {
  n: string;
  c: string;
  t?: string;
  i: Array<{ n: string; g: 0 | 1; m: [number, number, number]; s?: number }>;
  l: Array<[number, number]>;
}

// base64url over bytes

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('bad characters');
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// Compression

export const canCompress = (): boolean => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function pipeThrough(bytes: Uint8Array, transform: { writable: WritableStream<BufferSource>; readable: ReadableStream<Uint8Array> }): Promise<Uint8Array> {
  const writer = transform.writable.getWriter();
  void writer.write(bytes as Uint8Array<ArrayBuffer>).catch(() => undefined);
  void writer.close().catch(() => undefined);
  const reader = transform.readable.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_JSON_BYTES) {
      await reader.cancel();
      throw new Error('too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

// Encoding

function toWire(recipe: Recipe, ingredients: Ingredient[]): Wire {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const wire: Wire = { n: recipe.name, c: recipe.color, i: [], l: [] };
  if (recipe.notes) wire.t = recipe.notes;
  const index = new Map<string, number>();
  for (const line of recipe.lines) {
    const ingredient = byId.get(line.ingredientId);
    if (!ingredient) throw new Error('The recipe uses an ingredient that no longer exists.');
    let at = index.get(ingredient.id);
    if (at === undefined) {
      at = wire.i.length;
      index.set(ingredient.id, at);
      const entry: Wire['i'][number] = {
        n: ingredient.name,
        g: ingredient.group === 'flavor' ? 1 : 0,
        m: MINERAL_ORDER.map((m) => ingredient.minerals[m] ?? 0) as [number, number, number],
      };
      if (ingredient.gramsPerTsp) entry.s = ingredient.gramsPerTsp;
      wire.i.push(entry);
    }
    wire.l.push([at, line.gramsPerServing]);
  }
  return wire;
}

export function defaultBaseUrl(): string {
  return `${location.origin}/lmnt-calculator/`;
}

/** Builds the share link for a recipe. `ingredients` must include every ingredient the recipe uses. */
export async function encodeRecipeLink(
  recipe: Recipe,
  ingredients: Ingredient[],
  baseUrl: string = defaultBaseUrl(),
  options: { compress?: boolean } = {},
): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toWire(recipe, ingredients)));
  let payload: string;
  if (options.compress !== false && canCompress()) {
    payload = `${LINK_VERSION}z${toBase64Url(await pipeThrough(json, new CompressionStream('deflate-raw')))}`;
  } else {
    payload = `${LINK_VERSION}p${toBase64Url(json)}`;
  }
  return `${baseUrl.replace(/#.*$/, '')}#r=${payload}`;
}

// Decoding

const BAD_LINK = "This recipe link looks damaged or incomplete. Ask for it to be sent again.";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const inRange = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

function fromWire(raw: unknown): SharedRecipe {
  if (!isObj(raw) || !text(raw.n, 100) || !text(raw.c, 40)) throw new Error('header');
  if (raw.t !== undefined && (typeof raw.t !== 'string' || raw.t.length > 2000)) throw new Error('notes');
  if (!Array.isArray(raw.i) || raw.i.length > 60 || !Array.isArray(raw.l) || raw.l.length > 60) throw new Error('lists');
  const ingredients: SharedIngredient[] = raw.i.map((entry: unknown) => {
    if (!isObj(entry) || !text(entry.n, 100) || (entry.g !== 0 && entry.g !== 1)) throw new Error('ingredient');
    if (!Array.isArray(entry.m) || entry.m.length !== 3 || !entry.m.every((f) => inRange(f, 0, 1))) throw new Error('minerals');
    if (entry.s !== undefined && !inRange(entry.s, 0.001, 1000)) throw new Error('tsp');
    const minerals: MineralFractions = {};
    MINERAL_ORDER.forEach((mineral, k) => {
      const fraction = (entry.m as number[])[k]!;
      if (fraction > 0) minerals[mineral] = fraction;
    });
    const out: SharedIngredient = { name: entry.n, group: entry.g === 1 ? 'flavor' : 'base', minerals };
    if (entry.s !== undefined) out.gramsPerTsp = entry.s;
    return out;
  });
  const lines = raw.l.map((line: unknown) => {
    if (!Array.isArray(line) || line.length !== 2 || !Number.isInteger(line[0]) || !inRange(line[1], 0, 10_000)) {
      throw new Error('line');
    }
    const ingredient = ingredients[line[0] as number];
    if (!ingredient) throw new Error('line index');
    return { ingredient, gramsPerServing: line[1] as number };
  });
  const recipe: SharedRecipe = { name: raw.n.trim(), color: raw.c, lines };
  if (raw.t) recipe.notes = raw.t;
  return recipe;
}

/** Pulls the payload out of a full URL, a `#r=...` fragment or a bare `r=...`. */
function extractPayload(input: string): string | undefined {
  const hash = input.includes('#') ? input.slice(input.indexOf('#') + 1) : input;
  const match = /^r=([^&]*)/.exec(hash.trim());
  return match?.[1];
}

/** Reads a share link. Never throws: bad input gives `{ ok: false, error }`. */
export async function decodeRecipeLink(hashOrUrl: string): Promise<DecodeResult> {
  const payload = extractPayload(hashOrUrl);
  if (!payload) return { ok: false, error: "This isn't a recipe link." };
  const version = payload[0];
  if (version !== LINK_VERSION) {
    const numeric = /^\d$/.test(version ?? '') && Number(version) > Number(LINK_VERSION);
    return {
      ok: false,
      error: numeric ? 'This recipe was shared from a newer version of the app. Update the app and try again.' : BAD_LINK,
    };
  }
  try {
    const flag = payload[1];
    let bytes = fromBase64Url(payload.slice(2));
    if (flag === 'z') {
      if (!canCompress()) {
        return { ok: false, error: "This browser can't open compressed recipe links. Try a newer browser." };
      }
      bytes = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
    } else if (flag !== 'p' || bytes.length > MAX_JSON_BYTES) {
      return { ok: false, error: BAD_LINK };
    }
    const raw: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return { ok: true, recipe: fromWire(raw) };
  } catch {
    return { ok: false, error: BAD_LINK };
  }
}

// Importing

export type ImportMode = 'replace' | 'keepBoth';

export interface ImportResult {
  recipe: Recipe;
  /** Names of ingredients that had no match and were created (price 0, to be filled in). */
  createdIngredients: string[];
  /** True when an existing recipe was overwritten. */
  replaced: boolean;
}

/** The existing recipe with the same name (ignoring case), if any, so the UI can offer Replace or Keep both (SH3). */
export async function findRecipeClash(shared: SharedRecipe): Promise<Recipe | undefined> {
  const name = shared.name.trim().toLowerCase();
  return (await db.recipes.toArray()).find((r) => r.name.trim().toLowerCase() === name);
}

/**
 * Adds a shared recipe. Ingredients are matched by name (ignoring case);
 * unmatched ones are created with a price of 0 and a 100 g package. 'replace'
 * overwrites a same-named recipe in place; 'keepBoth' adds "Name (2)".
 */
export async function importSharedRecipe(shared: SharedRecipe, mode: ImportMode): Promise<ImportResult> {
  return db.transaction('rw', db.ingredients, db.recipes, async () => {
    const existing = await db.ingredients.toArray();
    const byName = new Map(existing.map((i) => [i.name.trim().toLowerCase(), i.id]));
    const createdIngredients: string[] = [];
    const lines: Recipe['lines'] = [];
    for (const { ingredient, gramsPerServing } of shared.lines) {
      const key = ingredient.name.trim().toLowerCase();
      let id = byName.get(key);
      if (!id) {
        const created = await createIngredient({
          name: ingredient.name.trim(),
          group: ingredient.group,
          packageGrams: 100,
          packagePrice: 0,
          minerals: ingredient.minerals,
          ...(ingredient.gramsPerTsp ? { gramsPerTsp: ingredient.gramsPerTsp } : {}),
        });
        id = created.id;
        byName.set(key, id);
        createdIngredients.push(created.name);
      }
      lines.push({ ingredientId: id, gramsPerServing });
    }
    const fields = { name: shared.name.trim(), color: shared.color, lines, ...(shared.notes ? { notes: shared.notes } : {}) };
    const clash = await findRecipeClash(shared);
    if (clash && mode === 'replace') {
      // `notes: undefined` makes Dexie remove the old notes when the shared recipe has none.
      await updateRecipe(clash.id, { name: fields.name, color: fields.color, lines, notes: shared.notes });
      return { recipe: (await db.recipes.get(clash.id))!, createdIngredients, replaced: true };
    }
    const taken = (await db.recipes.toArray()).map((r) => r.name);
    const recipe = await createRecipe({ ...fields, name: uniqueName(fields.name, taken) });
    return { recipe, createdIngredients, replaced: false };
  });
}
