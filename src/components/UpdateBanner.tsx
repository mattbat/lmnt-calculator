import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { applyUpdate } from '../pwaUpdate';

/** Mixing mode lives at `#/mix/...`; updates are held back there (T7). */
export function inMixingMode(hash = window.location.hash): boolean {
  return /^#\/mix(\/|$)/.test(hash);
}

/**
 * Shows "Update available" when a new version has downloaded (T7). Updates are
 * never applied silently, and the banner stays hidden while mixing mode is open.
 */
export function UpdateBanner({ update = applyUpdate }: { update?: () => Promise<void> }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version each hour while the app is open.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });
  const [updating, setUpdating] = useState(false);

  if (!needRefresh || inMixingMode()) return null;

  const onUpdate = async () => {
    setUpdating(true);
    await update();
  };

  return (
    <div className="update-banner" role="status">
      <span>A new version of LMNT Calculator is ready.</span>
      <button type="button" className="btn small" disabled={updating} onClick={() => void onUpdate()}>
        {updating ? 'Updating…' : 'Update'}
      </button>
      <button type="button" className="link" onClick={() => setNeedRefresh(false)}>
        Later
      </button>
    </div>
  );
}
