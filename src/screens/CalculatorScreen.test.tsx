import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSettings, updateSettings } from '../data/repo';
import { saveMixSession } from '../mixSession';
import { freshDb } from '../test/db';
import { CalculatorScreen } from './CalculatorScreen';

beforeEach(async () => {
  localStorage.clear();
  window.location.hash = '#/';
  await freshDb();
});

const amount = (id: string) => screen.getByTestId(`amount-${id}`);

async function open(id = 'watermelon') {
  render(<CalculatorScreen id={id} />);
  await screen.findByText('Weigh out');
}

describe('Calculator screen', () => {
  it('scales a 30-serving Watermelon batch (C1, C4)', async () => {
    await open();
    expect(screen.getByRole('heading', { name: 'Watermelon', level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText('Number of servings')).toHaveValue('30');
    expect(amount('salt')).toHaveTextContent('75.00 g');
    expect(amount('stevia')).toHaveTextContent('3.60 g');
    expect(amount('potassium-chloride')).toHaveTextContent('11.55 g');
    expect(screen.getByText(/16–32 oz/)).toBeInTheDocument();
    expect(screen.getByText(/Not medical advice · Not affiliated with LMNT/)).toBeInTheDocument();
  });

  it('recalculates instantly and remembers the size (C8)', async () => {
    const user = userEvent.setup();
    await open();
    const input = screen.getByLabelText('Number of servings');
    await user.clear(input);
    await user.type(input, '10');
    expect(amount('salt')).toHaveTextContent('25.00 g');
    await vi.waitFor(async () =>
      expect((await getSettings()).lastBatchSize.watermelon).toEqual({ mode: 'servings', servings: 10 }),
    );
  });

  it('sizes by vials (C2), converting with servings per vial', async () => {
    const user = userEvent.setup();
    await updateSettings({ servingsPerVial: 2 });
    await open();
    await user.click(screen.getByRole('radio', { name: 'Vials' }));
    const input = screen.getByLabelText('Number of vials');
    expect(input).toHaveValue('15');
    await user.clear(input);
    await user.type(input, '5');
    expect(amount('salt')).toHaveTextContent('25.00 g');
    expect(screen.getByText(/servings ·/)).toHaveTextContent('10 servings · 5 vials');
  });

  it('sizes by total weight (C3) and shows the leftover', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('radio', { name: 'Weight' }));
    const input = screen.getByLabelText('Total weight of mix (g)');
    await user.clear(input);
    await user.type(input, '100');
    // 100 g / 5.295 g per serving = 18 servings, 4.69 g left over
    expect(screen.getByText(/servings ·/)).toHaveTextContent('18 servings');
    expect(screen.getByText(/leftover/)).toHaveTextContent('4.69 g');
    expect(amount('salt')).toHaveTextContent('45.00 g');
  });

  it('switches between grams and ounces (U1)', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('radio', { name: 'oz' }));
    await vi.waitFor(() => expect(amount('salt')).toHaveTextContent('2.646 oz'));
    await user.click(screen.getByRole('radio', { name: 'Weight' }));
    expect(screen.getByLabelText('Total weight of mix (oz)')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'g' }));
    await vi.waitFor(() => expect(amount('salt')).toHaveTextContent(/ g$/));
  });

  it('warns when a line is below 10x the scale precision (C7)', async () => {
    const user = userEvent.setup();
    await updateSettings({ scalePrecision: 0.1 });
    await open();
    const input = screen.getByLabelText('Number of servings');
    await user.clear(input);
    await user.type(input, '1');
    // 0.12 g of stevia on a 0.1 g scale
    expect(screen.getAllByText(/Low precision/).length).toBeGreaterThan(0);
    await user.clear(input);
    await user.type(input, '30');
    expect(screen.queryByText(/Low precision/)).not.toBeInTheDocument();
  });

  it('shows electrolytes per serving as a nutrition-style label, without totals or cost (C6)', async () => {
    await open();
    const label = screen.getByRole('region', { name: 'Electrolytes per serving' });
    expect(label).toHaveTextContent('Per serving 5.295 g% Daily Value*');
    expect(label).toHaveTextContent('Sodium 950 mg41%');
    expect(label).toHaveTextContent('Potassium 202 mg4%');
    expect(label).toHaveTextContent('Magnesium 60 mg14%');
    expect(label).toHaveTextContent('Not an official nutrition label');
    expect(screen.queryByText(/saves/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\/serving ·/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Summary' })).not.toBeInTheDocument();
  });

  it('puts Start mixing and Share before the Weigh out list', async () => {
    await open();
    const start = screen.getByRole('button', { name: 'Start mixing' });
    const share = screen.getByRole('button', { name: 'Share recipe' });
    const weigh = screen.getByRole('heading', { name: 'Weigh out' });
    const batch = screen.getByRole('region', { name: 'Batch size' });
    const summary = screen.getByRole('region', { name: 'Electrolytes per serving' });
    const before = (x: Node, y: Node) => Boolean(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(before(batch, start)).toBe(true);
    expect(before(start, weigh)).toBe(true);
    expect(before(share, weigh)).toBe(true);
    expect(before(weigh, summary)).toBe(true);
  });

  it('rounds vials up', async () => {
    const user = userEvent.setup();
    await updateSettings({ servingsPerVial: 4 });
    await open();
    const input = screen.getByLabelText('Number of servings');
    await user.clear(input);
    await user.type(input, '10');
    expect(screen.getByText(/servings ·/)).toHaveTextContent('3 vials');
  });

  it('starts mixing and shares a link to the recipe page', async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { share }));
    await open();
    expect(screen.queryByRole('link', { name: 'Edit recipe' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Show approximate teaspoons' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Share recipe' }));
    await vi.waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0]![0].url).toBe(`${window.location.origin}/lmnt-calculator/#/recipe/watermelon`);
    vi.unstubAllGlobals();
    await user.click(screen.getByRole('button', { name: 'Start mixing' }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/mix/watermelon'));
  });

  it('resumes a saved mixing session, or starts over', async () => {
    const user = userEvent.setup();
    saveMixSession({
      sessionId: 'x',
      recipeId: 'watermelon',
      size: { mode: 'servings', servings: 30 },
      order: ['salt'],
      step: 0,
      startedAt: 1,
    });
    await open();
    expect(screen.getByRole('button', { name: 'Resume mixing' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/mix/watermelon'));
    expect(localStorage.getItem('lmnt-calculator.mix.watermelon')).toBeNull();
  });
});
