import { updateSettings } from '../data/repo';
import { paths } from '../router';

/** D1: shown once on first launch and must be acknowledged. */
export function DisclaimerGate() {
  return (
    <main className="screen gate">
      <h1>Before you start</h1>
      <div className="callout strong">
        <p>
          LMNT Calculator is a personal project, not medical advice. Each serving has about 1,000 mg of sodium. Check
          with a doctor first if you have kidney disease, high blood pressure, or heart failure, are pregnant, or take
          medication that affects potassium (for example ACE inhibitors, ARBs, or potassium-sparing diuretics).
        </p>
      </div>
      <p className="hint">
        It is not made by or affiliated with LMNT. <a href={paths.about()}>Read the full notice</a> any time under
        More → About.
      </p>
      <button type="button" className="btn big" onClick={() => void updateSettings({ disclaimerAcceptedAt: Date.now() })}>
        I understand
      </button>
    </main>
  );
}
