import { resetDb } from '../data/fixtures';
import { updateSettings } from '../data/repo';

/** A freshly seeded database; the first-launch notice is already accepted unless `accepted` is false. */
export async function freshDb(accepted = true): Promise<void> {
  await resetDb();
  if (accepted) await updateSettings({ disclaimerAcceptedAt: 1 });
}
