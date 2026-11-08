import { useCallback, useState } from 'react';

/**
 * Runs a write and keeps its error message (a RepoError is fit to show the
 * user) so a screen can display it instead of failing silently.
 */
export function useRun(): [string, (action: () => Promise<unknown> | unknown) => Promise<boolean>, () => void] {
  const [error, setError] = useState('');
  const run = useCallback(async (action: () => Promise<unknown> | unknown) => {
    try {
      setError('');
      await action();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, []);
  const clear = useCallback(() => setError(''), []);
  return [error, run, clear];
}
