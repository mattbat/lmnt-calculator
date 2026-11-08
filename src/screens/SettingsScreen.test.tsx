import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackup } from '../data/backup';
import { db } from '../data/db';
import { createBatch, getSettings, updateSettings } from '../data/repo';
import { freshDb } from '../test/db';
import { SettingsScreen } from './SettingsScreen';

const share = vi.hoisted(() => ({ outcome: 'downloaded' as string, calls: [] as Array<[string, string]> }));
vi.mock('../data/share', () => ({
  shareFile: vi.fn(async (name: string, text: string) => {
    share.calls.push([name, text]);
    return share.outcome;
  }),
  shareLink: vi.fn(),
}));

beforeEach(async () => {
  share.outcome = 'downloaded';
  share.calls = [];
  window.location.hash = '#/more/settings';
  await freshDb();
});

async function open() {
  const user = userEvent.setup();
  render(<SettingsScreen />);
  await screen.findByRole('heading', { name: 'Settings' });
  return user;
}

const fileInput = () => screen.getByLabelText('Choose backup file') as HTMLInputElement;
const backupFile = (text: string) => new File([text], 'backup.json', { type: 'application/json' });
const batchEntry = {
  madeAt: 1,
  recipeId: 'raw',
  recipeSnapshot: { name: 'Raw', color: '#64748b', lines: [] },
  servings: 1,
  vials: 1,
  servingsPerVial: 1,
  fillGramsPerVial: 1,
  lines: [],
  totalCost: 0,
  notes: 'kept',
};


describe('Settings', () => {
  it('changes units, precision, vials, default batch, retail price and theme', async () => {
    const user = await open();
    await user.click(screen.getByRole('radio', { name: 'Ounces' }));
    await user.click(screen.getByRole('radio', { name: '0.1 g' }));
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    for (const [label, value] of [
      ['Servings per vial', '2'],
      ['Default batch (servings)', '12'],
      ['Retail price per stick', '1.25'],
    ] as const) {
      const input = screen.getByLabelText(label);
      await user.clear(input);
      await user.type(input, value);
    }
    await vi.waitFor(async () => {
      expect(await getSettings()).toMatchObject({
        weightUnit: 'oz',
        scalePrecision: 0.1,
        theme: 'dark',
        servingsPerVial: 2,
        defaultServings: 12,
        retailPricePerServing: 1.25,
      });
    });
  });

  it('ignores a fractional servings-per-vial', async () => {
    const user = await open();
    await user.type(screen.getByLabelText('Servings per vial'), '.5');
    expect((await getSettings()).servingsPerVial).toBe(1);
  });

  it('explains scale precision with an info button (H-4)', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'About scale precision' }));
    expect(screen.getByText(/smallest step your scale shows/)).toBeInTheDocument();
  });

  it('backs up and records the time (B1)', async () => {
    const user = await open();
    expect(screen.getByText(/You have not made a backup yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back up now' }));
    expect(await screen.findByText(/Backup file downloaded/)).toBeInTheDocument();
    expect(share.calls).toHaveLength(1);
    expect(share.calls[0]![0]).toMatch(/^lmnt-calculator-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(share.calls[0]![1])).toMatchObject({ app: 'lmnt-calculator', format: 2 });
    expect((await getSettings()).lastBackupAt).toBeGreaterThan(0);
    expect(await screen.findByText(/Last backup:/)).toBeInTheDocument();
    share.outcome = 'cancelled';
    await user.click(screen.getByRole('button', { name: 'Back up now' }));
    expect(await screen.findByText('Backup cancelled.')).toBeInTheDocument();
    share.outcome = 'shared';
    await user.click(screen.getByRole('button', { name: 'Back up now' }));
    expect(await screen.findByText('Backup saved.')).toBeInTheDocument();
  });

  it('restores with a summary: merge (B2)', async () => {
    const user = await open();
    await createBatch(batchEntry);
    const mergeBackup = JSON.stringify(await createBackup());
    await db.batches.clear();
    await user.upload(fileInput(), backupFile(mergeBackup));
    const sheet = await screen.findByRole('dialog', { name: 'Restore from backup' });
    expect(sheet).toHaveTextContent('1 log entry');
    expect(sheet).toHaveTextContent('0 log entries');
    expect(sheet).toHaveTextContent('add 1');
    await user.click(within(sheet).getByRole('button', { name: 'Merge' }));
    expect(await screen.findByText(/The backup was merged in/)).toBeInTheDocument();
    expect(await db.batches.count()).toBe(1);
  });

  it('restores with a summary: replace all asks to confirm (B2)', async () => {
    const user = await open();
    const backup = JSON.stringify(await createBackup());
    await createBatch({
      madeAt: 1,
      recipeId: 'raw',
      recipeSnapshot: { name: 'Raw', color: '#64748b', lines: [] },
      servings: 1,
      vials: 1,
      servingsPerVial: 1,
      fillGramsPerVial: 1,
      lines: [],
      totalCost: 0,
      notes: 'new',
    });
    await user.upload(fileInput(), backupFile(backup));
    const sheet = await screen.findByRole('dialog', { name: 'Restore from backup' });
    await user.click(within(sheet).getByRole('button', { name: 'Replace all' }));
    const confirm = await screen.findByRole('dialog', { name: 'Replace everything?' });
    expect(confirm).toHaveTextContent('1 log entry');
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(await db.batches.count()).toBe(1);
    await user.click(within(sheet).getByRole('button', { name: 'Replace all' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Replace everything?' })).getByRole('button', { name: 'Replace all' }));
    expect(await screen.findByText(/Everything was replaced/)).toBeInTheDocument();
    expect(await db.batches.count()).toBe(0);
  });

  it('rejects files that are not backups', async () => {
    const user = await open();
    await user.upload(fileInput(), backupFile('hello'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/isn't a backup file/);
    await user.upload(fileInput(), backupFile('{"app":"other"}'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/isn't an LMNT Calculator backup/);
  });

  it('shows the B3 reminder when the log is old news', async () => {
    await createBatch({
      madeAt: 1,
      recipeId: 'raw',
      recipeSnapshot: { name: 'Raw', color: '#64748b', lines: [] },
      servings: 1,
      vials: 1,
      servingsPerVial: 1,
      fillGramsPerVial: 1,
      lines: [],
      totalCost: 0,
      notes: '',
    });
    await open();
    expect(await screen.findByText('Time for a backup')).toBeInTheDocument();
    await updateSettings({ lastBackupAt: Date.now() });
    await vi.waitFor(() => expect(screen.queryByText('Time for a backup')).not.toBeInTheDocument());
  });

  it('shows the version and checks for updates', async () => {
    const user = await open();
    expect(screen.getByText(/Version/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(await screen.findByText(/checked automatically|Checked|Could not check/)).toBeInTheDocument();
    const update = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { serviceWorker: { getRegistration: async () => ({ update }) } }));
    await user.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(await screen.findByText(/If a new version is available/)).toBeInTheDocument();
    expect(update).toHaveBeenCalled();
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { serviceWorker: { getRegistration: async () => { throw new Error('offline'); } } }));
    await user.click(screen.getByRole('button', { name: 'Check for updates' }));
    expect(await screen.findByText(/Could not check right now/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
