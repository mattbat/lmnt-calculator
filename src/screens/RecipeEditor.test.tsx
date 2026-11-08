import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../data/db';
import { freshDb } from '../test/db';
import { RecipeEditor } from './RecipeEditor';

beforeEach(async () => {
  window.location.hash = '#/';
  await freshDb();
});

async function open(id: string) {
  const user = userEvent.setup();
  render(<RecipeEditor id={id} />);
  await screen.findByLabelText('Name');
  return user;
}

describe('Recipe editor', () => {
  it('creates a recipe with live totals', async () => {
    const user = await open('new');
    expect(screen.getByText('No ingredients yet')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Name'), 'Cherry');
    await user.selectOptions(screen.getByLabelText('Add an ingredient'), 'Redmond Real Salt');
    await user.type(screen.getByLabelText('Grams per serving: Redmond Real Salt'), '2.5');
    const stat = (label: string) => screen.getByText(label).closest('div')!;
    expect(stat('Sodium')).toHaveTextContent('950 mg');
    expect(stat('Weight')).toHaveTextContent('2.5 g');
    expect(stat('Cost')).toHaveTextContent('$0.04');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    const saved = (await db.recipes.toArray()).find((r) => r.name === 'Cherry')!;
    expect(saved.lines).toEqual([{ ingredientId: 'salt', gramsPerServing: 2.5 }]);
    await vi.waitFor(() => expect(window.location.hash).toBe(`#/recipe/${saved.id}`));
  });

  it('asks for a name and for grams on every line', async () => {
    const user = await open('new');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Give the recipe a name.');
    await user.type(screen.getByLabelText('Name'), 'X');
    await user.selectOptions(screen.getByLabelText('Add an ingredient'), 'Stevia');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter grams per serving for Stevia.');
  });

  it('edits, reorders and removes lines of an existing recipe', async () => {
    const user = await open('lemon');
    expect(screen.getByLabelText('Name')).toHaveValue('Lemon');
    await user.click(screen.getByRole('button', { name: 'Move Redmond Real Salt down' }));
    await user.click(screen.getByRole('button', { name: 'Remove Stevia' }));
    const grams = screen.getByLabelText('Grams per serving: Citric acid');
    await user.clear(grams);
    await user.type(grams, '0.5');
    await user.click(screen.getByRole('radio', { name: 'Color #3b82f6' }));
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/recipe/lemon'));
    const lemon = (await db.recipes.get('lemon'))!;
    expect(lemon.color).toBe('#3b82f6');
    expect(lemon.lines.map((l) => l.ingredientId)).toEqual([
      'potassium-chloride',
      'salt',
      'magnesium-malate',
      'lemon-powder',
      'citric-acid',
    ]);
    expect(lemon.lines[4]!.gramsPerServing).toBe(0.5);
  });

  it('creates a new ingredient from the picker', async () => {
    const user = await open('new');
    await user.selectOptions(screen.getByLabelText('Add an ingredient'), '＋ New ingredient…');
    const sheet = await screen.findByRole('dialog', { name: 'New ingredient' });
    await user.type(within(sheet).getByLabelText('Name'), 'Cherry powder');
    await user.click(within(sheet).getByRole('button', { name: 'Save ingredient' }));
    expect(await screen.findByLabelText('Grams per serving: Cherry powder')).toBeInTheDocument();
    expect((await db.ingredients.toArray()).some((i) => i.name === 'Cherry powder' && i.packagePrice === 0)).toBe(true);
  });

  it('duplicates a recipe', async () => {
    const user = await open('raw');
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    await vi.waitFor(async () => expect(await db.recipes.count()).toBe(4));
    const copy = (await db.recipes.toArray()).find((r) => r.name === 'Raw (2)')!;
    await vi.waitFor(() => expect(window.location.hash).toBe(`#/recipe/${copy.id}/edit`));
  });

  it('deletes only after confirming', async () => {
    const user = await open('raw');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await db.recipes.count()).toBe(3);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('dialog', { name: 'Delete recipe?' })).toHaveTextContent('Batches already in your log are kept');
    await user.click(screen.getByRole('button', { name: 'Delete recipe' }));
    await vi.waitFor(async () => expect(await db.recipes.count()).toBe(2));
    expect(window.location.hash).toBe('#/');
  });

  it('says when a recipe does not exist', async () => {
    render(<RecipeEditor id="nope" />);
    expect(await screen.findByText('That recipe no longer exists')).toBeInTheDocument();
  });
});
