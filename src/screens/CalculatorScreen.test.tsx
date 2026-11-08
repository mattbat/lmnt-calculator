import { render, screen, within } from '@testing-library/react';
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

  it('shows approximate teaspoons, or "weigh only" (U2)', async () => {
    const user = userEvent.setup();
    await open();
    expect(screen.queryByText(/powders vary in density/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Show approximate teaspoons' }));
    expect(await screen.findByText('~15 tsp (approximate)')).toBeInTheDocument();
    expect(screen.getAllByText('weigh only').length).toBeGreaterThan(0);
    expect(screen.getByText(/powders vary in density/)).toBeInTheDocument();
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

  it('shows totals, electrolytes and savings (C5, C6)', async () => {
    await open();
    const stat = (label: string) => screen.getByText(label).closest('div')!;
    expect(stat('Cost per serving')).toHaveTextContent('$0.25');
    expect(stat('Saved per serving')).toHaveTextContent('$1.25');
    expect(stat('Saved per batch')).toHaveTextContent('$37.59');
    expect(stat('Batch weight')).toHaveTextContent('158.85 g');
    expect(stat('Fill per vial')).toHaveTextContent('5.30 g');
    expect(stat('Sodium')).toHaveTextContent('950 mg');
    expect(stat('Sodium')).toHaveTextContent('41% daily value');
    expect(stat('Potassium')).toHaveTextContent('202 mg');
    expect(stat('Magnesium')).toHaveTextContent('60 mg');
  });

  it('rounds vials up and notes the last, partial vial', async () => {
    const user = userEvent.setup();
    await updateSettings({ servingsPerVial: 4 });
    await open();
    const input = screen.getByLabelText('Number of servings');
    await user.clear(input);
    await user.type(input, '10');
    expect(screen.getByText(/servings ·/)).toHaveTextContent('3 vials');
    expect(screen.getByText(/last vial with 2 servings/)).toBeInTheDocument();
  });

  it('starts mixing, links to the editor, and can share', async () => {
    const user = userEvent.setup();
    await open();
    expect(screen.getByRole('link', { name: 'Edit recipe' })).toHaveAttribute('href', '#/recipe/watermelon/edit');
    await user.click(screen.getByRole('button', { name: 'Share recipe' }));
    const dialog = await screen.findByRole('dialog', { name: 'Share recipe' });
    await vi.waitFor(() => expect((within(dialog).getByLabelText('Recipe link') as HTMLTextAreaElement).value).toContain('#r='));
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
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
      actuals: {},
      startedAt: 1,
    });
    await open();
    expect(screen.getByRole('button', { name: 'Resume mixing' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    await vi.waitFor(() => expect(window.location.hash).toBe('#/mix/watermelon'));
    expect(localStorage.getItem('lmnt-calculator.mix.watermelon')).toBeNull();
  });
});
