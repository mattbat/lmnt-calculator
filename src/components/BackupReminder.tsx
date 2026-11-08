import { needsBackupReminder } from '../data/backup';
import { snoozeBackupReminder, useBatches, useSettings } from '../data/repo';
import { paths } from '../router';

/** B3: nudges when the log has entries and there's been no backup in 60 days. */
export function BackupReminder() {
  const settings = useSettings();
  const batches = useBatches();
  if (!settings || !batches || !needsBackupReminder(settings, batches.length)) return null;
  return (
    <aside className="callout" aria-label="Backup reminder">
      <strong>Time for a backup</strong>
      <p>Your data lives only on this phone. Save a backup file so a lost phone or cleared browser data can't erase it.</p>
      <div className="callout-actions">
        <a className="btn small" href={paths.settings()}>
          Back up now
        </a>
        <button type="button" className="btn ghost small" onClick={() => void snoozeBackupReminder()}>
          Not now
        </button>
      </div>
    </aside>
  );
}
