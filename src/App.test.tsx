import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { getSettings } from './data/repo';
import { freshDb } from './test/db';

beforeEach(async () => {
  window.location.hash = '#/';
  localStorage.clear();
  await freshDb();
});

describe('App shell', () => {
  it('shows the tab bar with Recipes selected and the three recipes', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Recipes' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toBeInTheDocument();
    for (const label of ['Recipes', 'Log', 'Ingredients', 'More']) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /Recipes/ })).toHaveAttribute('aria-current', 'page');
    for (const name of ['Raw', 'Lemon', 'Watermelon']) {
      expect(await screen.findByText(name)).toBeInTheDocument();
    }
    expect(screen.getByText(/Not medical advice · Not affiliated with LMNT/)).toBeInTheDocument();
  });

  it('switches screens with the tabs and hides them while mixing', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('link', { name: /Ingredients/ }));
    expect(await screen.findByRole('heading', { name: 'Ingredients' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ingredients/ })).toHaveAttribute('aria-current', 'page');
    act(() => {
      window.location.hash = '#/log';
    });
    expect(await screen.findByRole('heading', { name: 'Log' })).toBeInTheDocument();
    act(() => {
      window.location.hash = '#/more';
    });
    expect(await screen.findByRole('heading', { name: 'More' })).toBeInTheDocument();
    for (const [hash, heading] of [
      ['#/more/settings', 'Settings'],
      ['#/more/about', 'About'],
      ['#/more/help', 'Help'],
      ['#/recipe/lemon', 'Lemon'],
      ['#/recipe/lemon/edit', 'Lemon'],
      ['#/log/missing', 'Entry not found'],
    ] as const) {
      act(() => {
        window.location.hash = hash;
      });
      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    }
    act(() => {
      window.location.hash = '#/mix/lemon';
    });
    expect(await screen.findByRole('heading', { name: 'Mixing Lemon' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('applies the theme setting', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Recipes' });
    expect(['light', 'dark']).toContain(document.documentElement.dataset.theme);
  });
});

describe('first-launch notice (D1)', () => {
  it('blocks the app until it is acknowledged, once', async () => {
    await freshDb(false);
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    expect(await screen.findByRole('heading', { name: 'Before you start' })).toBeInTheDocument();
    expect(screen.getByText(/not medical advice/i)).toBeInTheDocument();
    expect(screen.getByText(/1,000 mg of sodium/)).toBeInTheDocument();
    expect(screen.getByText(/ACE inhibitors/)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'I understand' }));
    expect(await screen.findByRole('heading', { name: 'Recipes' })).toBeInTheDocument();
    expect((await getSettings()).disclaimerAcceptedAt).toBeGreaterThan(0);
    unmount();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Recipes' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Before you start' })).not.toBeInTheDocument();
  });
});
