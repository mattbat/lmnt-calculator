import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../data/db';
import { createBatch, createIngredient, createRecipe, updateIngredient, updateRecipe, updateSettings, type BatchInput } from '../data/repo';
import { freshDb } from '../test/db';
import { AboutScreen, HelpScreen, MoreScreen } from './InfoScreens';
import { IngredientsScreen } from './IngredientsScreen';
import { LogEntryScreen } from './LogEntryScreen';
import { LogScreen } from './LogScreen';
import { RecipesScreen } from './RecipesScreen';

beforeEach(async () => {
  window.location.hash = '#/';
  localStorage.setItem('lmnt-calculator.installHintDismissed', '1');
  await freshDb();
});

const entry = (over: Partial<BatchInput> = {}): BatchInput => ({
  madeAt: Date.UTC(2026, 10, 1),
  recipeId: 'watermelon',
  recipeSnapshot: {
    name: 'Watermelon',
    color: '#f43f5e',
    lines: [
      { ingredientId: 'salt', gramsPerServing: 2.5 },
      { ingredientId: 'stevia', gramsPerServing: 0.12 },
    ],
  },
  servings: 30,
  vials: 30,
  servingsPerVial: 1,
  fillGramsPerVial: 2.62,
  lines: [
    { ingredientId: 'salt', name: 'Redmond Real Salt', gramsPerServing: 2.5, targetGrams: 75, actualGrams: 80 },
    { ingredientId: 'stevia', name: 'Stevia', gramsPerServing: 0.12, targetGrams: 3.6 },
  ],
  totalCost: 3.5,
  notes: 'First line\nSecond line',
  ...over,
});

describe('Recipes screen', () => {
  it('shows a card per recipe with cost and electrolytes', async () => {
    render(<RecipesScreen />);
    const card = (await screen.findByText('Watermelon')).closest('a')!;
    expect(card).toHaveAttribute('href', '#/recipe/watermelon');
    expect(card).toHaveTextContent('$0.25');
    expect(card).toHaveTextContent('5.295 g per serving');
    expect(card).toHaveTextContent('Na 950 mg · K 202 mg · Mg 60 mg');
    expect(screen.getByRole('link', { name: '+ New recipe' })).toHaveAttribute('href', '#/recipe/new/edit');
  });

  it('explains an empty list', async () => {
    await db.recipes.clear();
    render(<RecipesScreen />);
    expect(await screen.findByText('No recipes yet')).toBeInTheDocument();
  });

  it('opens a pasted recipe link', async () => {
    const user = userEvent.setup();
    render(<RecipesScreen />);
    await user.click(await screen.findByRole('button', { name: 'Paste recipe link' }));
    const sheet = screen.getByRole('dialog', { name: 'Paste recipe link' });
    await user.type(within(sheet).getByLabelText('Recipe link'), 'hello');
    await user.click(within(sheet).getByRole('button', { name: 'Open recipe' }));
    expect(within(sheet).getByRole('alert')).toBeInTheDocument();
    await user.clear(within(sheet).getByLabelText('Recipe link'));
    await user.type(within(sheet).getByLabelText('Recipe link'), 'Try https://mattbat.com/lmnt-calculator/#r=1pabc');
    await user.click(within(sheet).getByRole('button', { name: 'Open recipe' }));
    expect(window.location.hash).toBe('#r=1pabc');
  });

  it('reminds about backups when the log has entries (B3)', async () => {
    await createBatch(entry());
    render(<RecipesScreen />);
    expect(await screen.findByText('Time for a backup')).toBeInTheDocument();
  });
});

describe('Ingredients screen', () => {
  it('lists prices per gram and flags a missing price', async () => {
    await createIngredient({ name: 'Cherry powder', group: 'flavor', packageGrams: 100, packagePrice: 0, minerals: {} });
    render(<IngredientsScreen />);
    const salt = (await screen.findByRole('button', { name: 'Edit Redmond Real Salt' })).closest('li')!;
    expect(salt).toHaveTextContent('$11.39');
    expect(salt).toHaveTextContent('$0.0155/g');
    const cherry = screen.getByRole('button', { name: 'Edit Cherry powder' }).closest('li')!;
    expect(within(cherry).getByText('Price not set')).toBeInTheDocument();
    expect(within(salt).queryByText('Price not set')).not.toBeInTheDocument();
  });

  it('edits a price so costs follow', async () => {
    const user = userEvent.setup();
    render(<IngredientsScreen />);
    await user.click(await screen.findByRole('button', { name: 'Edit Redmond Real Salt' }));
    const sheet = screen.getByRole('dialog', { name: 'Edit Redmond Real Salt' });
    const price = within(sheet).getByLabelText('Package price');
    await user.clear(price);
    await user.type(price, '20');
    await user.click(within(sheet).getByRole('button', { name: 'Save ingredient' }));
    await vi.waitFor(async () => expect((await db.ingredients.get('salt'))!.packagePrice).toBe(20));
    // Untouched package size keeps full precision.
    expect((await db.ingredients.get('salt'))!.packageGrams).toBeCloseTo(737.0876, 4);
  });

  it('converts package sizes from oz, lb and kg (U4)', async () => {
    const user = userEvent.setup();
    render(<IngredientsScreen />);
    await user.click(await screen.findByRole('button', { name: '+ Add ingredient' }));
    const sheet = screen.getByRole('dialog', { name: 'New ingredient' });
    await user.type(within(sheet).getByLabelText('Name'), 'Test powder');
    const size = within(sheet).getByLabelText('Package size');
    await user.clear(size);
    await user.type(size, '2');
    await user.selectOptions(within(sheet).getByLabelText('Unit'), 'lb');
    expect(sheet).toHaveTextContent('= 907.2 g');
    await user.type(within(sheet).getByLabelText('Package price'), '10');
    await user.type(within(sheet).getByLabelText('Sodium'), '39.3');
    await user.click(within(sheet).getByRole('button', { name: 'Save ingredient' }));
    await vi.waitFor(async () => {
      const added = (await db.ingredients.toArray()).find((i) => i.name === 'Test powder')!;
      expect(added.packageGrams).toBeCloseTo(907.185, 2);
      expect(added.minerals).toEqual({ sodium: 0.393 });
    });
  });

  it('measures grams per teaspoon (U3)', async () => {
    const user = userEvent.setup();
    render(<IngredientsScreen />);
    await user.click(await screen.findByRole('button', { name: 'Edit Stevia' }));
    const sheet = screen.getByRole('dialog', { name: 'Edit Stevia' });
    expect(within(sheet).getByRole('button', { name: 'Use as grams per tsp' })).toBeDisabled();
    await user.type(within(sheet).getByLabelText(/Weight of 1 level tsp/), '3.5');
    await user.click(within(sheet).getByRole('button', { name: 'Use as grams per tsp' }));
    expect(within(sheet).getByLabelText('Grams per teaspoon')).toHaveValue('3.5');
    await user.click(within(sheet).getByRole('button', { name: 'Save ingredient' }));
    await vi.waitFor(async () => expect((await db.ingredients.get('stevia'))!.gramsPerTsp).toBe(3.5));
  });

  it('validates, and refuses to delete an ingredient in use', async () => {
    const user = userEvent.setup();
    render(<IngredientsScreen />);
    await user.click(await screen.findByRole('button', { name: '+ Add ingredient' }));
    await user.click(screen.getByRole('button', { name: 'Save ingredient' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Give the ingredient a name.');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Edit Stevia' }));
    await user.click(screen.getByRole('button', { name: 'Delete ingredient' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/is used by/);
    expect(await db.ingredients.get('stevia')).toBeDefined();
  });

  it('deletes an unused ingredient after confirming', async () => {
    const user = userEvent.setup();
    const extra = await createIngredient({ name: 'Spare', group: 'flavor', packageGrams: 100, packagePrice: 1, minerals: {} });
    render(<IngredientsScreen />);
    await user.click(await screen.findByRole('button', { name: 'Edit Spare' }));
    await user.click(screen.getByRole('button', { name: 'Delete ingredient' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await vi.waitFor(async () => expect(await db.ingredients.get(extra.id)).toBeUndefined());
  });
});

describe('Log screens', () => {
  it('explains an empty log', async () => {
    render(<LogScreen />);
    expect(await screen.findByText('No batches yet')).toBeInTheDocument();
  });

  it('lists entries newest first, filterable by recipe (L2)', async () => {
    const user = userEvent.setup();
    await updateSettings({ lastBackupAt: Date.now() });
    await createBatch(entry({ madeAt: 1000, recipeId: 'lemon', recipeSnapshot: { name: 'Lemon', color: '#facc15', lines: [] }, notes: '' }));
    await createBatch(entry({ madeAt: 2000, rating: 4 }));
    render(<LogScreen />);
    const rows = await screen.findAllByRole('link');
    expect(rows[0]).toHaveTextContent('Watermelon');
    expect(rows[0]).toHaveTextContent('★★★★');
    expect(rows[0]).toHaveTextContent('First line');
    expect(rows[0]).not.toHaveTextContent('Second line');
    expect(rows[1]).toHaveTextContent('Lemon');
    await user.selectOptions(screen.getByLabelText('Show'), 'Lemon');
    await vi.waitFor(() => expect(screen.queryByRole('link', { name: /Watermelon/ })).not.toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText('Show'), 'Raw');
    expect(await screen.findByText('No batches for this recipe')).toBeInTheDocument();
  });

  it('logs a batch by hand (L5)', async () => {
    const user = userEvent.setup();
    render(<LogScreen />);
    await user.click(await screen.findByRole('button', { name: '+ Log a batch by hand' }));
    const sheet = screen.getByRole('dialog', { name: 'Log a batch' });
    await user.selectOptions(within(sheet).getByLabelText('Recipe'), 'Lemon');
    const servings = within(sheet).getByLabelText('Servings');
    await user.clear(servings);
    await user.type(servings, '10');
    await user.type(within(sheet).getByLabelText(/Notes/), 'Made at the cabin');
    await user.click(within(sheet).getByRole('button', { name: 'Save to log' }));
    await vi.waitFor(async () => expect(await db.batches.count()).toBe(1));
    const [b] = await db.batches.toArray();
    expect(b).toMatchObject({ recipeId: 'lemon', servings: 10, notes: 'Made at the cabin' });
    expect(b!.lines).toHaveLength(6);
    expect(window.location.hash).toBe(`#/log/${b!.id}`);
  });

  it('shows an entry, flags off-target weights, and saves notes and rating (L1, L3, L6)', async () => {
    const user = userEvent.setup();
    const b = await createBatch(entry());
    render(<LogEntryScreen id={b.id} />);
    expect(await screen.findByRole('heading', { name: 'Watermelon' })).toBeInTheDocument();
    expect(screen.getByText('More than 5% off target')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toHaveValue('First line\nSecond line');
    const notes = screen.getByLabelText('Notes');
    await user.clear(notes);
    await user.type(notes, 'Too sweet');
    await user.click(screen.getByRole('button', { name: 'Save notes' }));
    await vi.waitFor(async () => expect((await db.batches.get(b.id))!.notes).toBe('Too sweet'));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '4 stars' }));
    await vi.waitFor(async () => expect((await db.batches.get(b.id))!.rating).toBe(4));
    await user.click(screen.getByRole('radio', { name: '4 stars' }));
    await vi.waitFor(async () => expect((await db.batches.get(b.id))!.rating).toBeUndefined());
  });

  it('deletes an entry after confirming (L5)', async () => {
    const user = userEvent.setup();
    const b = await createBatch(entry());
    render(<LogEntryScreen id={b.id} />);
    await user.click(await screen.findByRole('button', { name: 'Delete entry' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await db.batches.count()).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Delete entry' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete entry' }));
    await vi.waitFor(async () => expect(await db.batches.count()).toBe(0));
    expect(window.location.hash).toBe('#/log');
  });

  it('Make again opens the calculator at that size when the recipe is unchanged (L4)', async () => {
    const user = userEvent.setup();
    const recipe = (await db.recipes.get('watermelon'))!;
    const b = await createBatch(entry({ servings: 12, recipeSnapshot: { name: 'Watermelon', color: '#f43f5e', lines: recipe.lines } }));
    render(<LogEntryScreen id={b.id} />);
    await user.click(await screen.findByRole('button', { name: 'Make again' }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/recipe/watermelon'));
    expect((await db.settings.toArray())[0]!.lastBatchSize.watermelon).toEqual({ mode: 'servings', servings: 12 });
  });

  it('Make again asks which version when the recipe has changed (L4)', async () => {
    const user = userEvent.setup();
    const b = await createBatch(entry({ servings: 12 }));
    render(<LogEntryScreen id={b.id} />);
    await user.click(await screen.findByRole('button', { name: 'Make again' }));
    const sheet = await screen.findByRole('dialog', { name: 'This recipe has changed' });
    await user.click(within(sheet).getByRole('button', { name: 'Use the recipe as it is now' }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/recipe/watermelon'));

    window.location.hash = '#/';
    await user.click(screen.getByRole('button', { name: 'Make again' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /as it was then/ }));
    await vi.waitFor(async () => expect((await db.recipes.toArray()).some((r) => r.name === 'Watermelon (2)')).toBe(true));
    const copy = (await db.recipes.toArray()).find((r) => r.name === 'Watermelon (2)')!;
    expect(copy.lines).toHaveLength(2);
    await vi.waitFor(() => expect(window.location.hash).toBe(`#/recipe/${copy.id}`));
  });

  it('can bring back a deleted recipe from the snapshot (L4)', async () => {
    const user = userEvent.setup();
    const b = await createBatch(entry());
    await db.recipes.delete('watermelon');
    render(<LogEntryScreen id={b.id} />);
    await user.click(await screen.findByRole('button', { name: 'Make again' }));
    expect(await screen.findByText(/has been deleted/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bring it back as it was' }));
    await vi.waitFor(async () => expect((await db.recipes.toArray()).some((r) => r.name === 'Watermelon')).toBe(true));
  });

  it('keeps the log untouched when its recipe is edited later (L1)', async () => {
    const b = await createBatch(entry());
    await updateRecipe('watermelon', { lines: [] });
    await updateIngredient('salt', { packagePrice: 99 });
    expect((await db.batches.get(b.id))!.recipeSnapshot.lines).toHaveLength(2);
  });

  it('says when an entry does not exist', async () => {
    render(<LogEntryScreen id="nope" />);
    expect(await screen.findByText("That log entry doesn't exist")).toBeInTheDocument();
  });
});

describe('More, About and Help', () => {
  it('links to settings, help and about', () => {
    render(<MoreScreen />);
    expect(screen.getByRole('link', { name: /Settings/ })).toHaveAttribute('href', '#/more/settings');
    expect(screen.getByRole('link', { name: /Help/ })).toHaveAttribute('href', '#/more/help');
    expect(screen.getByRole('link', { name: /About/ })).toHaveAttribute('href', '#/more/about');
  });

  it('has the credit, disclaimer and equipment placeholder (D3)', () => {
    render(<AboutScreen />);
    expect(screen.getByRole('link', { name: /best homemade electrolyte drink/ })).toHaveAttribute(
      'href',
      'https://science.drinklmnt.com/electrolytes/best-homemade-electrolyte-drink-for-dehydration',
    );
    expect(screen.getByRole('link', { name: 'Buy the real thing' })).toHaveAttribute('href', 'https://drinklmnt.com');
    expect(screen.getByText(/not made by, endorsed by, or affiliated with LMNT/)).toBeInTheDocument();
    expect(screen.getByText(/not medical advice/i)).toBeInTheDocument();
    expect(screen.getByText(/Store powders away from children/)).toBeInTheDocument();
    expect(screen.getByText(/responsible for your ingredients/)).toBeInTheDocument();
    expect(screen.getByText('Coming soon: the scale, vials and tools I use.')).toBeInTheDocument();
  });

  it('has help topics', () => {
    render(<HelpScreen />);
    for (const title of ['Making a batch', 'Mixing mode', 'Sharing a recipe', 'Backups', 'Measuring by teaspoon', 'Storage tips']) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });
});

describe('recipe edits show up in the list', () => {
  it('lists a newly created recipe', async () => {
    const created = await createRecipe({ name: 'Mine', color: '#22c55e', lines: [{ ingredientId: 'salt', gramsPerServing: 1 }] });
    render(<RecipesScreen />);
    expect(await screen.findByText('Mine')).toBeInTheDocument();
    expect(created.sortOrder).toBe(3);
  });
});
