import { useState } from 'react';
import { DEVIATION_FLAG, formatWeight, weightDeviation } from '../calc';
import { Chip, Confirm, Empty, Footer, Loading, Sheet, TopBar } from '../components/ui';
import {
  createRecipe,
  deleteBatch,
  setLastBatchSize,
  uniqueName,
  updateBatchNotes,
  updateBatchRating,
  useBatches,
  useRecipes,
  useSettings,
} from '../data/repo';
import { formatDateTime, money } from '../format';
import { useRun } from '../hooks/useRun';
import { navigate, paths } from '../router';
import type { BatchLogEntry, Recipe, RecipeLine, Settings } from '../types';

function sameLines(a: RecipeLine[], b: RecipeLine[]): boolean {
  return (
    a.length === b.length &&
    a.every((l, i) => l.ingredientId === b[i]!.ingredientId && Math.abs(l.gramsPerServing - b[i]!.gramsPerServing) < 1e-9)
  );
}

function EntryBody({ batch, recipes, settings }: { batch: BatchLogEntry; recipes: Recipe[]; settings: Settings }) {
  const [notes, setNotes] = useState(batch.notes);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [error, run] = useRun();
  const fmt = (g: number) => formatWeight(g, settings.weightUnit, settings.scalePrecision);
  const current = recipes.find((r) => r.id === batch.recipeId);

  const open = async (recipeId: string) => {
    await setLastBatchSize(recipeId, { mode: 'servings', servings: batch.servings });
    navigate(paths.recipe(recipeId));
  };

  const makeAgain = () => {
    if (current && sameLines(current.lines, batch.recipeSnapshot.lines)) void run(() => open(current.id));
    else setChoosing(true);
  };

  const restoreThen = () =>
    run(async () => {
      const copy = await createRecipe({
        name: uniqueName(
          batch.recipeSnapshot.name,
          recipes.map((r) => r.name),
        ),
        color: batch.recipeSnapshot.color,
        lines: batch.recipeSnapshot.lines.map((l) => ({ ...l })),
      });
      await open(copy.id);
    });

  const saveNotes = async () => {
    if (notes === batch.notes) return;
    await run(() => updateBatchNotes(batch.id, notes));
    setSaved(true);
  };

  return (
    <main className="screen">
      <TopBar title={batch.recipeSnapshot.name} back={paths.log()} backLabel="Back to log" color={batch.recipeSnapshot.color} />
      <p className="muted">{formatDateTime(batch.madeAt)}</p>
      <dl className="stats">
        <div>
          <dt>Servings</dt>
          <dd className="num">{Number(batch.servings.toFixed(2))}</dd>
        </div>
        <div>
          <dt>Vials</dt>
          <dd className="num">{batch.vials}</dd>
        </div>
        <div>
          <dt>Fill per vial</dt>
          <dd className="num">{fmt(batch.fillGramsPerVial)}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd className="num">{money(batch.totalCost)}</dd>
        </div>
      </dl>

      <h2>Ingredients</h2>
      <ul className="lines">
        {batch.lines.map((l) => {
          const off = l.actualGrams !== undefined && weightDeviation(l.actualGrams, l.targetGrams) > DEVIATION_FLAG;
          return (
            <li key={l.ingredientId} className="line">
              <div className="line-main">
                <span className="line-name">{l.name}</span>
                <span className="line-amount num">{fmt(l.targetGrams)}</span>
              </div>
              {l.actualGrams !== undefined && (
                <div className="line-sub">
                  Weighed <span className="num">{fmt(l.actualGrams)}</span> {off && <Chip>More than 5% off target</Chip>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <h2>Rating</h2>
      <div className="stars" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={batch.rating === n}
            aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
            className={batch.rating !== undefined && n <= batch.rating ? 'star on' : 'star'}
            onClick={() => void run(() => updateBatchRating(batch.id, batch.rating === n ? undefined : n))}
          >
            ★
          </button>
        ))}
      </div>

      <h2>Notes</h2>
      <div className="field">
        <textarea
          className="notes"
          rows={5}
          aria-label="Notes"
          value={notes}
          placeholder="A bit sour; try 0.5 g less malic acid next time"
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
          onBlur={() => void saveNotes()}
        />
      </div>
      <div className="actions row">
        <button type="button" className="btn" onClick={() => void saveNotes()}>
          Save notes
        </button>
        {saved && <span role="status">Saved</span>}
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="button" className="btn big" onClick={makeAgain}>
          Make again
        </button>
        <button type="button" className="btn ghost danger-text" onClick={() => setConfirmDelete(true)}>
          Delete entry
        </button>
      </div>
      <Footer />
      {choosing && (
        <Sheet title="This recipe has changed" onClose={() => setChoosing(false)}>
          <p>
            {current
              ? `${batch.recipeSnapshot.name} is different now from when you made this batch. Which version do you want?`
              : `${batch.recipeSnapshot.name} has been deleted. You can bring it back as it was.`}
          </p>
          <div className="actions">
            {current && (
              <button type="button" className="btn" onClick={() => void run(() => open(current.id))}>
                Use the recipe as it is now
              </button>
            )}
            <button type="button" className={current ? 'btn ghost' : 'btn'} onClick={() => void restoreThen()}>
              {current ? 'Use it as it was then (adds a copy)' : 'Bring it back as it was'}
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Sheet>
      )}
      {confirmDelete && (
        <Confirm
          title="Delete this entry?"
          message="This removes the batch from your log. It can't be undone."
          confirmLabel="Delete entry"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            void run(async () => {
              await deleteBatch(batch.id);
              navigate(paths.log());
            });
          }}
        />
      )}
    </main>
  );
}

/** Log entry (§8, §9 screen 6). */
export function LogEntryScreen({ id }: { id: string }) {
  const batches = useBatches();
  const recipes = useRecipes();
  const settings = useSettings();
  if (!batches || !recipes || !settings) {
    return (
      <main className="screen">
        <Loading />
      </main>
    );
  }
  const batch = batches.find((b) => b.id === id);
  if (!batch) {
    return (
      <main className="screen">
        <TopBar title="Entry not found" back={paths.log()} />
        <Empty title="That log entry doesn't exist">
          <a href={paths.log()}>Back to the log</a>
        </Empty>
      </main>
    );
  }
  return <EntryBody key={batch.id} batch={batch} recipes={recipes} settings={settings} />;
}
