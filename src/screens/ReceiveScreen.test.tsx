import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../data/db';
import { encodeRecipeLink } from '../data/recipeLink';
import { createIngredient, createRecipe, deleteIngredient, deleteRecipe } from '../data/repo';
import { freshDb } from '../test/db';
import { ReceiveScreen } from './ReceiveScreen';

beforeEach(async () => {
  window.location.hash = '#/';
  await freshDb();
});

async function linkData(name: string): Promise<string> {
  const recipe = (await db.recipes.toArray()).find((r) => r.name === name)!;
  const link = await encodeRecipeLink(recipe, await db.ingredients.toArray(), 'https://example.test/lmnt-calculator/');
  return link.slice(link.indexOf('#r=') + 3);
}

describe('Receive screen (SH3)', () => {
  it('previews a recipe and offers Keep both / Replace when the name exists', async () => {
    const user = userEvent.setup();
    render(<ReceiveScreen data={await linkData('Lemon')} />);
    expect(await screen.findByRole('heading', { name: 'Lemon' })).toBeInTheDocument();
    expect(screen.getByText('Lemon powder')).toBeInTheDocument();
    expect(screen.getAllByText(/you have this ingredient/).length).toBe(6);
    expect(screen.getByText('950 mg')).toBeInTheDocument();
    expect(screen.getByText(/Not medical advice · Not affiliated with LMNT/)).toBeInTheDocument();
    expect(screen.getByText(/You already have a recipe called/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep both' }));
    expect(await screen.findByRole('heading', { name: 'Recipe added' })).toBeInTheDocument();
    expect((await db.recipes.toArray()).map((r) => r.name)).toContain('Lemon (2)');
    expect(screen.getByRole('link', { name: 'Open Lemon (2)' })).toBeInTheDocument();
  });

  it('replaces a same-named recipe', async () => {
    const user = userEvent.setup();
    const data = await linkData('Lemon');
    await db.recipes.update('lemon', { lines: [{ ingredientId: 'salt', gramsPerServing: 9 }] });
    render(<ReceiveScreen data={data} />);
    await user.click(await screen.findByRole('button', { name: 'Replace' }));
    await screen.findByText(/Replaced/);
    expect(await db.recipes.count()).toBe(3);
    expect((await db.recipes.get('lemon'))!.lines).toHaveLength(6);
  });

  it('creates unknown ingredients without a price and says so', async () => {
    const user = userEvent.setup();
    const ingredient = await createIngredient({
      name: 'Cherry powder',
      group: 'flavor',
      packageGrams: 200,
      packagePrice: 30,
      minerals: {},
      gramsPerTsp: 3,
    });
    const recipe = await createRecipe({
      name: 'Cherry',
      color: '#f43f5e',
      notes: 'Tart',
      lines: [{ ingredientId: ingredient.id, gramsPerServing: 1 }],
    });
    const data = await linkData('Cherry');
    await deleteRecipe(recipe.id);
    await deleteIngredient(ingredient.id);

    render(<ReceiveScreen data={data} />);
    expect(await screen.findByText(/new ingredient: price not set/)).toBeInTheDocument();
    expect(screen.getByText('Tart')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add to my recipes' }));
    expect(await screen.findByText('Set the prices')).toBeInTheDocument();
    expect(screen.getByText(/Cherry powder/)).toBeInTheDocument();
    const created = (await db.ingredients.toArray()).find((i) => i.name === 'Cherry powder')!;
    expect(created.packagePrice).toBe(0);
    expect(created.packageGrams).toBe(100);
    expect(screen.getByRole('link', { name: 'Open Ingredients' })).toHaveAttribute('href', '#/ingredients');
  });

  it('copies the link for the installed app (SH4)', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const data = await linkData('Raw');
    render(<ReceiveScreen data={data} />);
    await user.click(await screen.findByRole('button', { name: 'Copy for the LMNT Calculator app' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`#r=${data}`));
    expect(await screen.findByText(/Paste recipe link/)).toBeInTheDocument();
    writeText.mockRejectedValue(new Error('denied'));
    await user.click(screen.getByRole('button', { name: 'Copy for the LMNT Calculator app' }));
    expect(await screen.findByText(/Could not copy automatically/)).toBeInTheDocument();
  });

  it('shows a friendly error for a damaged link (SH5)', async () => {
    render(<ReceiveScreen data="1zNOT-A-RECIPE" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/damaged or incomplete/);
    expect(screen.getByRole('link', { name: 'Go to my recipes' })).toBeInTheDocument();
  });
});
