import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../data/db';
import { createBatch, updateSettings, type BatchInput } from '../data/repo';
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
    expect(card.textContent).not.toMatch(/\d\s*g per serving/);
    expect(card.textContent).not.toMatch(/\d\s*oz per serving/);
    expect(card).toHaveTextContent('Na 950 mg · K 202 mg · Mg 60 mg');
    expect(screen.queryByRole('link', { name: '+ New recipe' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Paste recipe link' })).not.toBeInTheDocument();
  });

  it('reminds about backups when the log has entries (B3)', async () => {
    await createBatch(entry());
    render(<RecipesScreen />);
    expect(await screen.findByText('Time for a backup')).toBeInTheDocument();
  });

  it('hides the backup reminder with Not now, and keeps it snoozed (B3)', async () => {
    const user = userEvent.setup();
    await createBatch(entry());
    const view = render(<RecipesScreen />);
    await user.click(await screen.findByRole('button', { name: 'Not now' }));
    await vi.waitFor(() => expect(screen.queryByText('Time for a backup')).not.toBeInTheDocument());
    const snoozedUntil = (await db.settings.toArray())[0]!.backupReminderSnoozedUntil!;
    expect(snoozedUntil).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    view.unmount();
    render(<RecipesScreen />);
    await screen.findByText('Watermelon');
    expect(screen.queryByText('Time for a backup')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Not now' })).not.toBeInTheDocument();
  });
});

describe('Ingredients screen', () => {
  it('is a read-only price list with prices per gram', async () => {
    render(<IngredientsScreen />);
    const salt = (await screen.findByText('Redmond Real Salt')).closest('li')!;
    expect(salt).toHaveTextContent('737.1 g package');
    expect(salt).toHaveTextContent('$11.39');
    expect(salt).toHaveTextContent('$0.0155/g');
    expect(within(salt).queryByText('Price not set')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/Built-in prices/)).toBeInTheDocument();
    expect(screen.getByText('Stevia').closest('li')).toHaveTextContent('Flavor');
  });

  it('lists bases first, salt at the top, then flavors', async () => {
    render(<IngredientsScreen />);
    await screen.findByText('Redmond Real Salt');
    const groups = screen.getAllByRole('listitem').map((li) => (li.textContent!.includes('Base') ? 'base' : 'flavor'));
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Redmond Real Salt');
    expect(groups).toEqual([...groups].sort());
    expect(groups.filter((g) => g === 'base')).toHaveLength(3);
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

  it('shows an entry, old weighed amounts, and saves notes and rating (L1, L3, L6)', async () => {
    const user = userEvent.setup();
    const b = await createBatch(entry());
    render(<LogEntryScreen id={b.id} />);
    expect(await screen.findByRole('heading', { name: 'Watermelon' })).toBeInTheDocument();
    expect(screen.getByText('Weighed')).toBeInTheDocument();
    expect(screen.queryByText('More than 5% off target')).not.toBeInTheDocument();
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

  it('Make again opens the calculator at that size (L4)', async () => {
    const user = userEvent.setup();
    const b = await createBatch(entry({ servings: 12 }));
    render(<LogEntryScreen id={b.id} />);
    await user.click(await screen.findByRole('button', { name: 'Make again' }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/recipe/watermelon'));
    expect((await db.settings.toArray())[0]!.lastBatchSize.watermelon).toEqual({ mode: 'servings', servings: 12 });
  });

  it('hides Make again when the recipe no longer exists, and still shows the snapshot (L4)', async () => {
    const b = await createBatch(entry({ recipeId: 'gone' }));
    render(<LogEntryScreen id={b.id} />);
    expect(await screen.findByRole('heading', { name: 'Watermelon' })).toBeInTheDocument();
    expect(screen.getByText('Redmond Real Salt')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make again' })).not.toBeInTheDocument();
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
    for (const title of ['Making a batch', 'Mixing mode', 'Sharing a recipe', 'Backups', 'Storage tips']) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    expect(screen.queryByText('Measuring by teaspoon')).not.toBeInTheDocument();
    expect(screen.getByText(/link to that recipe's page/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/teaspoon|Paste recipe link|actual weight/i);
  });
});
