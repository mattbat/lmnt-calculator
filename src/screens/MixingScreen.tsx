import { useEffect, useMemo, useState } from 'react';
import {
  calculateBatch,
  formatWeight,
  mixingOrder,
  vialPlan,
} from '../calc';
import { Chip, Confirm, Footer, Loading, TopBar } from '../components/ui';
import { createBatch, newId, updateBatchNotes, useIngredients, useRecipe, useSettings } from '../data/repo';
import { buildBatchInput } from '../batchEntry';
import { useWakeLock } from '../hooks/useWakeLock';
import {
  clearMixSession,
  loadMixSession,
  moveItem,
  reconcileOrder,
  saveMixSession,
  type MixSession,
} from '../mixSession';
import { navigate, paths } from '../router';
import type { Ingredient, Recipe, Settings } from '../types';

const TIPS_KEY = 'lmnt-calculator.mixTipsSeen';

function tipsSeen(): boolean {
  try {
    return localStorage.getItem(TIPS_KEY) === '1';
  } catch {
    return false;
  }
}

function MixingBody({ recipe, ingredients, settings }: { recipe: Recipe; ingredients: Ingredient[]; settings: Settings }) {
  const [session, setSession] = useState<MixSession>(() => {
    const saved = loadMixSession(recipe.id);
    const size = saved?.size ?? settings.lastBatchSize[recipe.id] ?? { mode: 'servings', servings: settings.defaultServings };
    const initial = calculateBatch(recipe, ingredients, size, settings);
    const fresh = mixingOrder(initial.lines).map((l) => l.ingredientId);
    const order = saved ? reconcileOrder(saved.order, fresh) : fresh;
    return {
      sessionId: saved?.sessionId ?? newId(),
      recipeId: recipe.id,
      size,
      order,
      step: saved ? Math.min(Math.max(0, saved.step), order.length + 1) : 0,
      startedAt: saved?.startedAt ?? Date.now(),
    };
  });
  const [finishedId, setFinishedId] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showTips, setShowTips] = useState(() => !tipsSeen());
  const [saveError, setSaveError] = useState('');
  const held = useWakeLock(finishedId === undefined);

  // M6: keep progress so a locked phone or a reload resumes on the same step.
  useEffect(() => {
    if (finishedId === undefined) saveMixSession(session);
  }, [session, finishedId]);

  const result = useMemo(
    () => calculateBatch(recipe, ingredients, session.size, settings),
    [recipe, ingredients, session.size, settings],
  );
  const plan = vialPlan(result, settings.servingsPerVial);
  const lineById = new Map(result.lines.map((l) => [l.ingredientId, l]));
  const order = session.order.filter((id) => lineById.has(id));
  const unit = settings.weightUnit;
  const fmt = (grams: number) => formatWeight(grams, unit, settings.scalePrecision);

  const mixStep = order.length;
  const fillStep = order.length + 1;
  const step = Math.min(session.step, fillStep);
  const go = (to: number) => setSession((s) => ({ ...s, step: Math.min(Math.max(0, to), fillStep) }));

  // Postpones the current ingredient: it swaps with the next one, which becomes the current step.
  const postpone = () =>
    setSession((s) => {
      const from = s.order.indexOf(order[step]!);
      const to = s.order.indexOf(order[step + 1]!);
      return { ...s, order: moveItem(s.order, from, to) };
    });

  const finish = async () => {
    try {
      const batch = await createBatch(
        buildBatchInput({ recipe, result, settings, order }),
      );
      clearMixSession(recipe.id);
      setFinishedId(batch.id);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save the batch.');
    }
  };

  const saveNotes = async () => {
    if (finishedId && notes.trim()) await updateBatchNotes(finishedId, notes.trim());
    navigate(paths.log());
  };

  if (finishedId !== undefined) {
    return (
      <main className="screen mix">
        <TopBar title="Batch logged" color={recipe.color} />
        <p className="big-note">
          Your {recipe.name} batch ({Number(result.servings.toFixed(2))} servings) is in the log.
        </p>
        <div className="field">
          <label className="field-label">
            <span>Notes (optional)</span>
            <textarea
              className="notes"
              rows={4}
              value={notes}
              placeholder="How did it taste? What would you change next time?"
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        <div className="actions">
          <button type="button" className="btn big mix-btn" onClick={() => void saveNotes()}>
            Save notes and view log
          </button>
        </div>
        <Footer />
      </main>
    );
  }

  const stepLabels = [...order.map((id) => lineById.get(id)!.name), 'Mix', 'Fill'];
  const line = step < mixStep ? lineById.get(order[step]!) : undefined;

  return (
    <main className="screen mix">
      <TopBar
        title={`Mixing ${recipe.name}`}
        color={recipe.color}
        action={
          <button type="button" className="btn ghost small-ink" onClick={() => setConfirmCancel(true)}>
            Cancel
          </button>
        }
      />
      <p className="hint" role="status">
        {held ? 'Screen will stay on while you mix.' : 'If the screen locks, set Auto-Lock to Never while you mix.'}
      </p>

      <nav className="progress" aria-label="Mixing progress">
        {stepLabels.map((label, i) => (
          <button
            key={`${label}-${i}`}
            type="button"
            className={i === step ? 'pstep current' : i < step ? 'pstep done' : 'pstep'}
            aria-current={i === step ? 'step' : undefined}
            aria-label={`Step ${i + 1} of ${stepLabels.length}: ${label}${i < step ? ', done' : ''}`}
            onClick={() => go(i)}
          >
            {i < step ? '✓' : i + 1}
          </button>
        ))}
      </nav>

      {showTips && step === 0 && (
        <aside className="callout" aria-label="Mixing tips">
          <strong>Tips</strong>
          <p>
            Weigh on a dry day. Fruit powder and malic acid absorb moisture and clump. Use sealed vials and a food-safe
            desiccant pack.
          </p>
          <button
            type="button"
            className="link"
            onClick={() => {
              setShowTips(false);
              try {
                localStorage.setItem(TIPS_KEY, '1');
              } catch {
                // Private browsing: just hide for now.
              }
            }}
          >
            Got it
          </button>
        </aside>
      )}

      {line ? (
        <section className="mix-step" aria-label={`Step ${step + 1}: ${line.name}`}>
          <p className="tare">⚖️ Tare the scale first (empty container on, press zero)</p>
          <p className="step-count">
            Ingredient {step + 1} of {order.length}
          </p>
          <h2 className="mix-name">{line.name}</h2>
          <p className="mix-target num" data-testid="target">
            {fmt(line.batchGrams)}
          </p>
          {line.lowPrecision && <Chip>Low precision: a small amount for this scale</Chip>}
          <div className="actions">
            <button type="button" className="btn big mix-btn" onClick={() => go(step + 1)}>
              Done → next
            </button>
            <div className="actions row">
              <button type="button" className="btn ghost mix-btn" disabled={step === 0} onClick={() => go(step - 1)}>
                Back
              </button>
              <button
                type="button"
                className="btn ghost mix-btn"
                disabled={step >= order.length - 1}
                onClick={postpone}
              >
                Weigh later
              </button>
            </div>
          </div>
        </section>
      ) : step === mixStep ? (
        <section className="mix-step" aria-label="Mix">
          <h2 className="mix-name">Mix</h2>
          <p className="big-note">Combine and mix thoroughly. Break up any clumps.</p>
          <div className="actions">
            <button type="button" className="btn big mix-btn" onClick={() => go(step + 1)}>
              Done → next
            </button>
            <button type="button" className="btn ghost mix-btn" onClick={() => go(step - 1)}>
              Back
            </button>
          </div>
        </section>
      ) : (
        <section className="mix-step" aria-label="Fill">
          <h2 className="mix-name">Fill</h2>
          <p className="big-note">
            Fill <strong className="num">{plan.totalVials}</strong> {plan.totalVials === 1 ? 'vial' : 'vials'} with{' '}
            <strong className="num">{fmt(result.fillGramsPerVial)}</strong> each.
          </p>
          {plan.partialServings > 0 && (
            <p className="big-note">
              The last vial is a partial: {Number(plan.partialServings.toFixed(2))}{' '}
              {plan.partialServings === 1 ? 'serving' : 'servings'}, <span className="num">{fmt(plan.partialGrams)}</span>.
            </p>
          )}
          {result.leftoverGrams > 0 && (
            <p className="muted">
              Leftover mix: <span className="num">{fmt(result.leftoverGrams)}</span> (not enough for another serving).
            </p>
          )}
          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}
          <div className="actions">
            <button type="button" className="btn big mix-btn" onClick={() => void finish()}>
              Finish
            </button>
            <button type="button" className="btn ghost mix-btn" onClick={() => go(step - 1)}>
              Back
            </button>
          </div>
        </section>
      )}
      <Footer />
      {confirmCancel && (
        <Confirm
          title="Cancel this batch?"
          message="Your progress will be discarded and nothing is logged."
          confirmLabel="Discard batch"
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() => {
            clearMixSession(recipe.id);
            navigate(paths.recipe(recipe.id));
          }}
        />
      )}
    </main>
  );
}

/** Mixing mode (§7): one ingredient at a time, screen kept on, resumable. */
export function MixingScreen({ id }: { id: string }) {
  const recipe = useRecipe(id);
  const ingredients = useIngredients();
  const settings = useSettings();
  if (!recipe || !ingredients || !settings) {
    return (
      <main className="screen mix">
        <Loading />
        <p className="hint">
          If this doesn't load, the recipe may have been deleted. <a href={paths.recipes()}>Back to recipes</a>
        </p>
      </main>
    );
  }
  return <MixingBody key={recipe.id} recipe={recipe} ingredients={ingredients} settings={settings} />;
}
