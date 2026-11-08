import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';

beforeEach(() => {
  window.location.hash = '#/';
  localStorage.clear();
});

describe('App shell', () => {
  it('shows the tab bar with Recipes selected and a placeholder screen', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toBeInTheDocument();
    for (const label of ['Recipes', 'Log', 'Ingredients', 'More']) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /Recipes/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'Recipes' })).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });

  it('switches screens with the tabs', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('link', { name: /Ingredients/ }));
    expect(await screen.findByRole('heading', { name: 'Ingredients' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ingredients/ })).toHaveAttribute('aria-current', 'page');
    act(() => {
      window.location.hash = '#/log';
    });
    expect(await screen.findByRole('heading', { name: 'Log' })).toBeInTheDocument();
  });
});
