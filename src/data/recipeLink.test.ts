import { CompressionStream as NodeCompressionStream, DecompressionStream as NodeDecompressionStream } from 'node:stream/web';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_INGREDIENTS, DEFAULT_RECIPES } from '../calc/defaults';
import type { Ingredient, Recipe } from '../types';
import { db } from './db';
import { resetDb } from './fixtures';
import {
  canCompress,
  decodeRecipeLink,
  defaultBaseUrl,
  encodeRecipeLink,
  findRecipeClash,
  importSharedRecipe,
  type SharedRecipe,
} from './recipeLink';
import { createRecipe } from './repo';

const BASE = 'https://mattbat.com/lmnt-calculator/';

beforeAll(() => {
  // jsdom may not expose the stream compressors that real browsers have.
  if (typeof globalThis.CompressionStream === 'undefined') {
    vi.stubGlobal('CompressionStream', NodeCompressionStream);
    vi.stubGlobal('DecompressionStream', NodeDecompressionStream);
  }
});

beforeEach(resetDb);
afterEach(() => vi.restoreAllMocks());

const watermelon = DEFAULT_RECIPES.find((r) => r.id === 'watermelon')!;

function shared(recipe: Recipe, ingredients: Ingredient[] = DEFAULT_INGREDIENTS): SharedRecipe {
  return {
    name: recipe.name,
    color: recipe.color,
    ...(recipe.notes ? { notes: recipe.notes } : {}),
    lines: recipe.lines.map((l) => {
      const i = ingredients.find((x) => x.id === l.ingredientId)!;
      return {
        ingredient: {
          name: i.name,
          group: i.group,
          minerals: i.minerals,
          ...(i.gramsPerTsp ? { gramsPerTsp: i.gramsPerTsp } : {}),
        },
        gramsPerServing: l.gramsPerServing,
      };
    }),
  };
}

describe('encodeRecipeLink and decodeRecipeLink (SH1, SH5)', () => {
  it('round-trips compressed and plain, from a full URL or just the hash', async () => {
    expect(canCompress()).toBe(true);
    const expected = shared(watermelon);
    const compressed = await encodeRecipeLink(watermelon, DEFAULT_INGREDIENTS, BASE);
    const plain = await encodeRecipeLink(watermelon, DEFAULT_INGREDIENTS, BASE, { compress: false });
    expect(compressed.startsWith(`${BASE}#r=1z`)).toBe(true);
    expect(plain.startsWith(`${BASE}#r=1p`)).toBe(true);
    expect(await decodeRecipeLink(compressed)).toEqual({ ok: true, recipe: expected });
    expect(await decodeRecipeLink(plain)).toEqual({ ok: true, recipe: expected });
    expect(await decodeRecipeLink(compressed.slice(compressed.indexOf('#')))).toEqual({ ok: true, recipe: expected });
    expect(await decodeRecipeLink(compressed.slice(compressed.indexOf('#') + 1))).toEqual({ ok: true, recipe: expected });
  });

  it('keeps a typical link under 1,500 characters', async () => {
    const link = await encodeRecipeLink(watermelon, DEFAULT_INGREDIENTS, BASE);
    expect(link.length).toBeLessThan(1500);
    expect(link).not.toContain('+');
    expect(link).not.toContain('/r=');
  });

  it('leaves out prices and buy links', async () => {
    const ingredients = DEFAULT_INGREDIENTS.map((i) => ({ ...i, buyUrl: 'https://shop.example/secret', packagePrice: 12.3456 }));
    const link = await encodeRecipeLink(watermelon, ingredients, BASE, { compress: false });
    const json = atob(link.split('#r=1p')[1]!.replace(/-/g, '+').replace(/_/g, '/'));
    expect(json).not.toMatch(/shop\.example|12\.3456|price|packageGrams/i);
  });

  it('carries notes, tsp weights and flavor groups, and skips zero fractions', async () => {
    const recipe: Recipe = { ...watermelon, notes: 'Shake well', lines: [{ ingredientId: 'salt', gramsPerServing: 2.5 }, { ingredientId: 'salt', gramsPerServing: 1 }] };
    const decoded = await decodeRecipeLink(await encodeRecipeLink(recipe, DEFAULT_INGREDIENTS, BASE));
    expect(decoded.ok && decoded.recipe.notes).toBe('Shake well');
    expect(decoded.ok && decoded.recipe.lines[0]!.ingredient).toEqual({
      name: 'Redmond Real Salt',
      group: 'base',
      minerals: { sodium: 0.38 },
      gramsPerTsp: 5,
    });
    // The same ingredient is sent once.
    const plain = await encodeRecipeLink(recipe, DEFAULT_INGREDIENTS, BASE, { compress: false });
    const json = JSON.parse(atob(plain.split('#r=1p')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    expect(json.i).toHaveLength(1);
    const flavor = await decodeRecipeLink(await encodeRecipeLink(watermelon, DEFAULT_INGREDIENTS, BASE));
    expect(flavor.ok && flavor.recipe.lines.some((l) => l.ingredient.group === 'flavor')).toBe(true);
  });

  it('refuses to encode a recipe with a missing ingredient', async () => {
    const bad: Recipe = { ...watermelon, lines: [{ ingredientId: 'ghost', gramsPerServing: 1 }] };
    await expect(encodeRecipeLink(bad, DEFAULT_INGREDIENTS, BASE)).rejects.toThrow(/no longer exists/);
  });

  it('uses the page origin by default, dropping any old fragment', async () => {
    expect(defaultBaseUrl()).toBe(`${location.origin}/lmnt-calculator/`);
    const link = await encodeRecipeLink(watermelon, DEFAULT_INGREDIENTS, `${BASE}#old`, { compress: false });
    expect(link.match(/#/g)).toHaveLength(1);
  });

  it('falls back to a plain payload without CompressionStream, and can read it', async () => {
    const z = await encodeRecipeLink(watermelon, DEFAULT_INGREDIENTS, BASE);
    vi.stubGlobal('CompressionStream', undefined);
    vi.stubGlobal('DecompressionStream', undefined);
    expect(canCompress()).toBe(false);
    const link = await encodeRecipeLink(watermelon, DEFAULT_INGREDIENTS, BASE);
    expect(link).toContain('#r=1p');
    expect((await decodeRecipeLink(link)).ok).toBe(true);
    // A compressed link on a browser that cannot inflate gets an explanation, not a crash.
    const result = await decodeRecipeLink(z);
    expect(!result.ok && result.error).toMatch(/can't open compressed/);
    vi.unstubAllGlobals();
  });
});

describe('damaged links', () => {
  async function errorOf(input: string): Promise<string> {
    const result = await decodeRecipeLink(input);
    expect(result.ok).toBe(false);
    return result.ok ? '' : result.error;
  }

  it('returns friendly errors, never throws', async () => {
    const good = await encodeRecipeLink(watermelon, DEFAULT_INGREDIENTS, BASE);
    const plain = await encodeRecipeLink(watermelon, DEFAULT_INGREDIENTS, BASE, { compress: false });
    expect(await errorOf('')).toMatch(/isn't a recipe link/);
    expect(await errorOf('https://mattbat.com/lmnt-calculator/')).toMatch(/isn't a recipe link/);
    expect(await errorOf('#r=')).toMatch(/isn't a recipe link/);
    expect(await errorOf('#x=abc')).toMatch(/isn't a recipe link/);
    expect(await errorOf('#r=garbage!!!')).toMatch(/damaged/);
    expect(await errorOf('#r=1zAAAA')).toMatch(/damaged/);
    expect(await errorOf('#r=1q' + 'AAAA')).toMatch(/damaged/);
    expect(await errorOf('#r=1')).toMatch(/damaged/);
    expect(await errorOf(good.slice(0, good.length - 30))).toMatch(/damaged/);
    expect(await errorOf(good.slice(0, 60))).toMatch(/damaged/);
    expect(await errorOf(plain.slice(0, plain.length - 40))).toMatch(/damaged/);
    expect(await errorOf('#r=1p' + btoa('{"n":'))).toMatch(/damaged/);
    expect(await errorOf('#r=1p' + btoa('not json'))).toMatch(/damaged/);
    expect(await errorOf('#r=7zAAAA')).toMatch(/newer version/);
    expect(await errorOf('#r=xzAAAA')).toMatch(/damaged/);
  });

  it('rejects well-formed JSON of the wrong shape', async () => {
    const bad = (value: unknown) => '#r=1p' + btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const ok = { n: 'A', c: '#fff', i: [{ n: 'Salt', g: 0, m: [0.4, 0, 0] }], l: [[0, 2]] };
    const result = await decodeRecipeLink(bad(ok));
    expect(result.ok).toBe(true);
    const variants: unknown[] = [
      null,
      [],
      { ...ok, n: '' },
      { ...ok, n: 5 },
      { ...ok, c: undefined },
      { ...ok, t: 5 },
      { ...ok, t: 'x'.repeat(3000) },
      { ...ok, i: 'x' },
      { ...ok, l: {} },
      { ...ok, i: [{ n: 'Salt', g: 2, m: [0, 0, 0] }] },
      { ...ok, i: [{ n: 'Salt', g: 0, m: [0, 0] }] },
      { ...ok, i: [{ n: 'Salt', g: 0, m: [2, 0, 0] }] },
      { ...ok, i: [{ n: 'Salt', g: 0, m: [0, 0, 0], s: -1 }] },
      { ...ok, i: [null] },
      { ...ok, l: [[0]] },
      { ...ok, l: [[0, -3]] },
      { ...ok, l: [[1, 2]] },
      { ...ok, l: [[0.5, 2]] },
      { ...ok, l: [[0, 'a']] },
      { ...ok, i: Array.from({ length: 61 }, () => ok.i[0]) },
    ];
    for (const variant of variants) {
      const r = await decodeRecipeLink(bad(variant));
      expect(r.ok, JSON.stringify(variant)).toBe(false);
    }
  });

  it('refuses a payload that inflates beyond the size limit', async () => {
    const huge = new TextEncoder().encode(JSON.stringify({ n: 'A', c: '#fff', i: [], l: [], t: 'x'.repeat(2_000_000) }));
    const stream = new NodeCompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    void writer.write(huge);
    void writer.close();
    const chunks: Uint8Array[] = [];
    const reader = stream.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    const payload = '1z' + bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(await errorOf('#r=' + payload)).toMatch(/damaged/);
  });
});

describe('importSharedRecipe (SH3)', () => {
  it('adds a recipe, matching ingredients by name ignoring case', async () => {
    const incoming = shared(watermelon);
    incoming.lines[0]!.ingredient.name = incoming.lines[0]!.ingredient.name.toUpperCase();
    const before = await db.ingredients.count();
    await db.recipes.delete('watermelon');
    const result = await importSharedRecipe(incoming, 'keepBoth');
    expect(result.createdIngredients).toEqual([]);
    expect(await db.ingredients.count()).toBe(before);
    expect(result.recipe.name).toBe('Watermelon');
    expect(result.replaced).toBe(false);
    expect(result.recipe.lines.map((l) => l.ingredientId)).toEqual(watermelon.lines.map((l) => l.ingredientId));
  });

  it('creates missing ingredients with price 0 and reuses them within one recipe', async () => {
    const mystery = { name: 'Mystery Salt', group: 'base' as const, minerals: { sodium: 0.3 }, gramsPerTsp: 4 };
    const incoming: SharedRecipe = {
      name: 'Odd',
      color: '#abc',
      notes: 'n',
      lines: [
        { ingredient: mystery, gramsPerServing: 1 },
        { ingredient: { ...mystery, name: 'mystery salt' }, gramsPerServing: 2 },
        { ingredient: { name: 'Plain', group: 'flavor', minerals: {} }, gramsPerServing: 3 },
      ],
    };
    const result = await importSharedRecipe(incoming, 'keepBoth');
    expect(result.createdIngredients).toEqual(['Mystery Salt', 'Plain']);
    const created = (await db.ingredients.toArray()).filter((i) => ['Mystery Salt', 'Plain'].includes(i.name));
    expect(created).toHaveLength(2);
    expect(created.every((i) => i.packagePrice === 0 && i.packageGrams > 0)).toBe(true);
    expect(created.find((i) => i.name === 'Mystery Salt')).toMatchObject({ minerals: { sodium: 0.3 }, gramsPerTsp: 4 });
    expect(result.recipe.lines[0]!.ingredientId).toBe(result.recipe.lines[1]!.ingredientId);
    expect(result.recipe.notes).toBe('n');
  });

  it('keepBoth names clashes "Name (2)", then "Name (3)"', async () => {
    const lemon = shared(DEFAULT_RECIPES.find((r) => r.id === 'lemon')!);
    expect((await findRecipeClash({ ...lemon, name: 'LEMON' }))?.id).toBe('lemon');
    expect(await findRecipeClash({ ...lemon, name: 'Nope' })).toBeUndefined();
    expect((await importSharedRecipe(lemon, 'keepBoth')).recipe.name).toBe('Lemon (2)');
    expect((await importSharedRecipe(lemon, 'keepBoth')).recipe.name).toBe('Lemon (3)');
    expect(await db.recipes.get('lemon')).toBeDefined();
  });

  it('replace overwrites the same-named recipe in place, including dropping old notes', async () => {
    await db.recipes.update('lemon', { notes: 'old notes' });
    const incoming: SharedRecipe = {
      name: 'lemon',
      color: '#111111',
      lines: [{ ingredient: { name: 'Citric acid', group: 'flavor', minerals: {} }, gramsPerServing: 9 }],
    };
    const before = (await db.recipes.get('lemon'))!;
    const result = await importSharedRecipe(incoming, 'replace');
    expect(result.replaced).toBe(true);
    expect(result.recipe.id).toBe('lemon');
    expect(result.recipe).toMatchObject({ name: 'lemon', color: '#111111', sortOrder: before.sortOrder });
    expect(result.recipe.lines).toEqual([{ ingredientId: 'citric-acid', gramsPerServing: 9 }]);
    expect(result.recipe.notes).toBeUndefined();
    expect(await db.recipes.count()).toBe(DEFAULT_RECIPES.length);
  });

  it('replace with no clash just adds the recipe', async () => {
    await createRecipe({ name: 'Other', color: '#1', lines: [] });
    const result = await importSharedRecipe({ name: 'Fresh', color: '#2', lines: [] }, 'replace');
    expect(result.replaced).toBe(false);
    expect(await db.recipes.count()).toBe(DEFAULT_RECIPES.length + 2);
  });

  it('imports a decoded link end to end', async () => {
    const link = await encodeRecipeLink(watermelon, DEFAULT_INGREDIENTS, BASE);
    const decoded = await decodeRecipeLink(link);
    if (!decoded.ok) throw new Error(decoded.error);
    const result = await importSharedRecipe(decoded.recipe, 'keepBoth');
    expect(result.recipe.name).toBe('Watermelon (2)');
    expect(result.recipe.lines).toEqual(watermelon.lines);
  });
});
