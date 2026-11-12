import { useState } from 'react';
import { BackupReminder } from '../components/BackupReminder';
import { Confirm, Info, Loading, NumField, Section, Segmented, Sheet, TopBar } from '../components/ui';
import {
  backupNow,
  parseBackup,
  restoreBackup,
  summarizeBackup,
  type Backup,
  type BackupSummary,
  type TableCounts,
} from '../data/backup';
import { updateSettings, useSettings } from '../data/repo';
import { lastError } from '../errorLog';
import { formatDateTime } from '../format';
import { paths } from '../router';
import type { ScalePrecision, Settings, ThemeSetting, WeightUnit } from '../types';

const counts = (c: TableCounts) => `${c.batches} log ${c.batches === 1 ? 'entry' : 'entries'}`;

function RestoreSheet({
  backup,
  summary,
  onClose,
  onDone,
}: {
  backup: Backup;
  summary: BackupSummary;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [error, setError] = useState('');
  const apply = async (mode: 'replace' | 'merge') => {
    try {
      await restoreBackup(backup, mode);
      onDone(mode === 'replace' ? 'Restored. Everything was replaced with the backup.' : 'Restored. The backup was merged in.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The backup could not be restored.');
      setConfirmReplace(false);
    }
  };
  const { added, updated, unchanged } = summary.merge;
  const sum = (c: TableCounts) => c.batches;
  return (
    <Sheet title="Restore from backup" onClose={onClose}>
      <p>
        Backup made {formatDateTime(summary.exportedAt)}.
      </p>
      <dl className="stats one-col">
        <div>
          <dt>In the backup</dt>
          <dd>{counts(summary.inFile)}</dd>
        </div>
        <div>
          <dt>On this device now</dt>
          <dd>{counts(summary.onDevice)}</dd>
        </div>
        <div>
          <dt>Merge would</dt>
          <dd>
            add {sum(added)}, update {sum(updated)}, leave {sum(unchanged)} unchanged
          </dd>
        </div>
      </dl>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="button" className="btn" onClick={() => void apply('merge')}>
          Merge
        </button>
        <button type="button" className="btn ghost danger-text" onClick={() => setConfirmReplace(true)}>
          Replace all
        </button>
      </div>
      <p className="hint">Merge keeps whichever copy of each item is newer. Replace all erases what is on this device first.</p>
      {confirmReplace && (
        <Confirm
          title="Replace everything?"
          message={`This erases ${counts(summary.onDevice)} on this device and replaces them with the backup. It can't be undone.`}
          confirmLabel="Replace all"
          onCancel={() => setConfirmReplace(false)}
          onConfirm={() => void apply('replace')}
        />
      )}
    </Sheet>
  );
}

function SettingsBody({ settings }: { settings: Settings }) {
  const [backupMessage, setBackupMessage] = useState('');
  const [restoreMessage, setRestoreMessage] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [pending, setPending] = useState<{ backup: Backup; summary: BackupSummary } | undefined>();
  const [updateMessage, setUpdateMessage] = useState('');
  const error = lastError();

  const doBackup = async () => {
    setBackupMessage('');
    const outcome = await backupNow();
    setBackupMessage(
      outcome === 'cancelled'
        ? 'Backup cancelled.'
        : outcome === 'shared'
          ? 'Backup saved.'
          : 'Backup file downloaded. Keep it somewhere safe.',
    );
  };

  const chooseFile = async (file: File | undefined) => {
    setRestoreMessage('');
    setRestoreError('');
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) return setRestoreError(parsed.error);
    setPending({ backup: parsed.backup, summary: await summarizeBackup(parsed.backup) });
  };

  const checkForUpdates = async () => {
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (!registration) return setUpdateMessage('Updates are checked automatically when you are online.');
      await registration.update();
      setUpdateMessage('Checked. If a new version is available, a banner will appear.');
    } catch {
      setUpdateMessage('Could not check right now. Are you online?');
    }
  };

  return (
    <main className="screen">
      <TopBar title="Settings" back={paths.more()} backLabel="Back to More" />
      <BackupReminder />

      <Section title="Mixing">
        <div className="set-row">
          <span className="set-label">Units</span>
          <Segmented<WeightUnit>
            label="Weight unit"
            value={settings.weightUnit}
            onChange={(weightUnit) => void updateSettings({ weightUnit })}
            options={[
              { value: 'g', label: 'Grams' },
              { value: 'oz', label: 'Ounces' },
            ]}
          />
        </div>
        <div className="set-row">
          <span className="set-label">
            <span id="precision-label">Scale precision</span>
            <Info label="scale precision">
              The smallest step your scale shows. Amounts are rounded to it, and amounts under 10 steps get a
              low-precision warning.
            </Info>
          </span>
          <Segmented<ScalePrecision>
            label="Scale precision"
            value={settings.scalePrecision}
            onChange={(scalePrecision) => void updateSettings({ scalePrecision })}
            options={[
              { value: 0.01, label: '0.01 g' },
              { value: 0.1, label: '0.1 g' },
              { value: 1, label: '1 g' },
            ]}
          />
        </div>
        <NumField
          inline
          label="Default batch (servings)"
          value={settings.defaultServings}
          onValue={(v) => v !== undefined && v > 0 && void updateSettings({ defaultServings: v })}
          min={0.0001}
        />
        <NumField
          inline
          label="Retail price per stick"
          value={settings.retailPricePerServing}
          onValue={(v) => v !== undefined && v >= 0 && void updateSettings({ retailPricePerServing: v })}
          suffix="$"
          min={0}
          info="What you would pay for one ready-made stick. Savings are this minus your cost per serving."
        />
        <div className="set-row">
          <span className="set-label">Theme</span>
          <Segmented<ThemeSetting>
            label="Theme"
            value={settings.theme}
            onChange={(theme) => void updateSettings({ theme })}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
      </Section>

      <Section title="Backup and restore">
        <p className="muted small">
          Your data lives only on this device, so back it up now and then.
          {settings.lastBackupAt ? ` Last backup: ${formatDateTime(settings.lastBackupAt)}.` : ' You have not made a backup yet.'}
        </p>
        <div className="actions row tight">
          <button type="button" className="btn" onClick={() => void doBackup()}>
            Back up now
          </button>
          <label className="btn ghost file-btn">
            Restore…
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="Choose backup file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                void chooseFile(file);
              }}
            />
          </label>
        </div>
        {backupMessage && <p role="status">{backupMessage}</p>}
        {restoreMessage && <p role="status">{restoreMessage}</p>}
        {restoreError && (
          <p className="form-error" role="alert">
            {restoreError}
          </p>
        )}
      </Section>

      <Section title="App">
        <div className="set-row">
          <span className="muted small">
            Version <span className="num">{__APP_VERSION__}</span> · built {__BUILD_TIME__}
          </span>
          <button type="button" className="btn ghost small" onClick={() => void checkForUpdates()}>
            Check for updates
          </button>
        </div>
        {updateMessage && <p role="status">{updateMessage}</p>}
        <p className="muted small">
          Diagnostics:{' '}
          {error
            ? `last error (${formatDateTime(error.at)}): ${error.message}${error.shown ? '' : ' (not shown)'}`
            : 'no errors recorded.'}
        </p>
      </Section>

      {pending && (
        <RestoreSheet
          backup={pending.backup}
          summary={pending.summary}
          onClose={() => setPending(undefined)}
          onDone={(message) => {
            setPending(undefined);
            setRestoreMessage(message);
          }}
        />
      )}
    </main>
  );
}

/** Settings (§9 screen 8, §12, §13). */
export function SettingsScreen() {
  const settings = useSettings();
  if (!settings) {
    return (
      <main className="screen">
        <Loading />
      </main>
    );
  }
  return <SettingsBody settings={settings} />;
}
