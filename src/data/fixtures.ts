import { db } from './db';

/** Resets the test database to a freshly seeded state. */
export async function resetDb(): Promise<void> {
  await db.delete();
  await db.open();
}
