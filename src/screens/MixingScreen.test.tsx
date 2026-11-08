import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../data/db';
import { setLastBatchSize, updateSettings } from '../data/repo';
import { loadMixSession } from '../mixSession';
import { freshDb } from '../test/db';
import { MixingScreen } from './MixingScreen';

beforeEach(async () => {
  localStorage.clear();
  window.location.hash = '#/mix/watermelon';
  await freshDb();
  await setLastBatchSize('watermelon', { mode: 'servings', servings: 30 });
});

afterEach(() => vi.unstubAllGlobals());

const next = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Done → next' }));

async function start() {
  const user = userEvent.setup();
  const view = render(<MixingScreen id="watermelon" />);
  await screen.findByText('Tare the scale first', { exact: false });
  return { user, ...view };
}

describe('Mixing mode', () => {
  it('walks base ingredients (largest first) then flavor (smallest first) (M1, M2, M4)', async () => {
    const { user } = await start();
    const expected = [
      ['Redmond Real Salt', '75.00 g'],
      ['Magnesium malate', '11.70 g'],
      ['Potassium chloride', '11.55 g'],
      ['Stevia', '3.60 g'],
      ['Malic acid', '18.00 g'],
      ['Watermelon juice powder', '39.00 g'],
    ];
    for (const [name, target] of expected) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
      expect(screen.getByTestId('target')).toHaveTextContent(target!);
      expect(screen.getByText(/Tare the scale first/)).toBeInTheDocument();
      await next(user);
    }
    expect(screen.getByRole('heading', { name: 'Mix' })).toBeInTheDocument();
    expect(screen.getByText(/Combine everything and mix thoroughly/)).toBeInTheDocument();
    await next(user);
    expect(screen.getByRole('heading', { name: 'Fill' })).toBeInTheDocument();
    expect(screen.getByText(/Fill/, { selector: 'p' })).toHaveTextContent('Fill 30 vials with 5.30 g each');
  });

  it('can jump back by tapping the progress strip', async () => {
    const { user } = await start();
    await next(user);
    await next(user);
    await user.click(screen.getByRole('button', { name: /Step 1 of 8: Redmond Real Salt, done/ }));
    expect(screen.getByRole('heading', { name: 'Redmond Real Salt' })).toBeInTheDocument();
    await next(user);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Redmond Real Salt' })).toBeInTheDocument();
  });

  it('flags an actual weight more than 5% off (M3)', async () => {
    const { user } = await start();
    const actual = screen.getByLabelText(/Actual weight/);
    await user.type(actual, '76');
    expect(screen.queryByText(/away from the target/)).not.toBeInTheDocument();
    await user.clear(actual);
    await user.type(actual, '80');
    expect(screen.getByText(/7% away from the target/)).toBeInTheDocument();
  });

  it('lets the current ingredient wait until later (M4)', async () => {
    const { user } = await start();
    await user.click(screen.getByRole('button', { name: 'Weigh later' }));
    expect(screen.getByRole('heading', { name: 'Magnesium malate' })).toBeInTheDocument();
    expect(loadMixSession('watermelon')?.order.slice(0, 2)).toEqual(['magnesium-malate', 'salt']);
    await next(user);
    expect(screen.getByRole('heading', { name: 'Redmond Real Salt' })).toBeInTheDocument();
  });

  it('resumes on the same step after a reload (M6)', async () => {
    const { user, unmount } = await start();
    await user.type(screen.getByLabelText(/Actual weight/), '75.2');
    await next(user);
    await next(user);
    unmount();
    render(<MixingScreen id="watermelon" />);
    expect(await screen.findByRole('heading', { name: 'Potassium chloride' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Step 1 of 8/ }));
    expect(screen.getByLabelText(/Actual weight/)).toHaveValue('75.2');
  });

  it('keeps the screen awake and says so (M6)', async () => {
    const sentinel = Object.assign(new EventTarget(), { release: vi.fn().mockResolvedValue(undefined) });
    const request = vi.fn().mockResolvedValue(sentinel);
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { wakeLock: { request } }));
    await start();
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    expect(await screen.findByText('Screen will stay on while you mix.')).toBeInTheDocument();
  });

  it('shows the tips once (M8)', async () => {
    const { user, unmount } = await start();
    expect(screen.getByText(/desiccant pack/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText(/desiccant pack/)).not.toBeInTheDocument();
    unmount();
    render(<MixingScreen id="watermelon" />);
    await screen.findByRole('heading', { name: 'Redmond Real Salt' });
    expect(screen.queryByText(/desiccant pack/)).not.toBeInTheDocument();
  });

  it('finishes into the log with actual weights, then saves notes (M5, M7)', async () => {
    const { user } = await start();
    await user.type(screen.getByLabelText(/Actual weight/), '75.1');
    for (let i = 0; i < 7; i++) await next(user);
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByRole('heading', { name: 'Batch logged' })).toBeInTheDocument();
    const [batch] = await db.batches.toArray();
    expect(batch).toMatchObject({ recipeId: 'watermelon', servings: 30, vials: 30, notes: '' });
    expect(batch!.lines[0]).toMatchObject({ ingredientId: 'salt', targetGrams: 75, actualGrams: 75.1 });
    expect(batch!.lines).toHaveLength(6);
    expect(batch!.totalCost).toBeCloseTo(7.41, 1);
    expect(loadMixSession('watermelon')).toBeUndefined();

    await user.type(screen.getByLabelText(/Notes/), 'A bit sweet');
    await user.click(screen.getByRole('button', { name: 'Save notes and view log' }));
    await vi.waitFor(async () => expect((await db.batches.toArray())[0]!.notes).toBe('A bit sweet'));
    expect(window.location.hash).toBe('#/log');
  });

  it('notes the partial last vial and leftover when filling', async () => {
    await updateSettings({ servingsPerVial: 4 });
    await setLastBatchSize('watermelon', { mode: 'servings', servings: 10 });
    const { user } = await start();
    for (let i = 0; i < 7; i++) await next(user);
    expect(screen.getByText(/Fill/, { selector: 'p' })).toHaveTextContent('Fill 3 vials with 21.18 g each');
    expect(screen.getByText(/last vial is a partial: 2 servings/)).toBeInTheDocument();
  });

  it('discards the batch after confirming (M7)', async () => {
    const { user } = await start();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'Cancel this batch?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard batch' }));
    expect(window.location.hash).toBe('#/recipe/watermelon');
    expect(loadMixSession('watermelon')).toBeUndefined();
    expect(await db.batches.count()).toBe(0);
  });
});
