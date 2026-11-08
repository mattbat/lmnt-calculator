import { useState } from 'react';

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** When opened in Safari rather than from the Home Screen, explains how to install (H-7). */
export function InstallHint() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('lmnt-calculator.installHintDismissed') === '1';
    } catch {
      return false;
    }
  });
  if (dismissed || isStandalone()) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('lmnt-calculator.installHintDismissed', '1');
    } catch {
      // Private browsing: just hide it for this visit.
    }
  };

  return (
    <aside className="callout" aria-label="Install LMNT Calculator">
      <strong>Add LMNT Calculator to your Home Screen</strong>
      <p>
        In Safari, tap <b>Share</b> <span aria-hidden>⬆︎</span> then <b>Add to Home Screen</b>. It then opens like an
        app and works without internet.
      </p>
      <button type="button" className="link" onClick={dismiss}>
        Got it
      </button>
    </aside>
  );
}
