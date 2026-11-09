import { useState } from 'react';
import { calculateBatch } from '../calc';
import { buildBatchInput } from '../batchEntry';
import { BackupReminder } from '../components/BackupReminder';
import { Empty, Loading, NumField, Sheet } from '../components/ui';
import { createBatch, useBatches, useIngredients, useRecipes, useSettings } from '../data/repo';
import { formatDate } from '../format';
import { useRun } from '../hooks/useRun';
import { navigate, paths } from '../router';

function ManualLogSheet({ onClose }: { onClose: () => void }) {
  const recipes = useRecipes();
  const ingredients = useIngredients();
  const settings = useSettings();
  const [recipeId, setRecipeId] = useState('');
  const [servings, setServings] = useState<number | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [error, run] = useRun();

  const recipe = recipes?.find((r) => r.id === (recipeId || recipes[0]?.id));

  const save = async () => {
    if (!recipe || !ingredients || !settings) return;
    const n = servings ?? settings.defaultServings;
    if (!(n > 0)) return setFormError('Enter how many servings you made.');
    const result = calculateBatch(recipe, ingredients, { mode: 'servings', servings: n }, settings);
    await run(async () => {
      const batch = await createBatch(buildBatchInput({ recipe, result, notes: notes.trim() }));
      onClose();
      navigate(paths.logEntry(batch.id));
    });
  };

  return (
    <Sheet title="Log a batch" onClose={onClose}>
      <p>Record a batch you already made, without going through mixing mode.</p>
      {!recipes || recipes.length === 0 ? (
        <Empty title="No recipes">Make a recipe first.</Empty>
      ) : (
        <>
          <label className="field-label">
            <span>Recipe</span>
            <select value={recipe?.id ?? ''} onChange={(e) => setRecipeId(e.target.value)}>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <NumField
            label="Servings"
            value={servings ?? settings?.defaultServings}
            onValue={setServings}
            min={0.0001}
          />
          <div className="field">
            <label className="field-label">
              <span>Notes (optional)</span>
              <textarea className="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
          {(formError || error) && (
            <p className="form-error" role="alert">
              {formError || error}
            </p>
          )}
          <div className="actions">
            <button type="button" className="btn" onClick={() => void save()}>
              Save to log
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Batch log (§8, §9 screen 6). */
export function LogScreen() {
  const recipes = useRecipes();
  const [filter, setFilter] = useState('');
  const batches = useBatches(filter || undefined);
  const [logging, setLogging] = useState(false);

  return (
    <main className="screen">
      <h1>Log</h1>
      <BackupReminder />
      {recipes && recipes.length > 0 && (
        <label className="field-label">
          <span>Show</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All recipes</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!batches ? (
        <Loading />
      ) : batches.length === 0 ? (
        <Empty title={filter ? 'No batches for this recipe' : 'No batches yet'}>
          When you finish a mixing session it is saved here with your notes. You can also log a batch by hand.
        </Empty>
      ) : (
        <ul className="cards">
          {batches.map((b) => (
            <li key={b.id}>
              <a className="card log-row" href={paths.logEntry(b.id)}>
                <span className="dot" style={{ background: b.recipeSnapshot.color }} aria-hidden />
                <span className="log-main">
                  <span className="line-name">{b.recipeSnapshot.name}</span>
                  <span className="muted small">
                    {formatDate(b.madeAt)} · {Number(b.servings.toFixed(2))} servings
                    {b.rating ? ` · ${'★'.repeat(b.rating)}` : ''}
                  </span>
                  {b.notes.trim() && <span className="note-line">{b.notes.trim().split('\n')[0]}</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="actions">
        <button type="button" className="btn ghost" onClick={() => setLogging(true)}>
          + Log a batch by hand
        </button>
      </div>
      {logging && <ManualLogSheet onClose={() => setLogging(false)} />}
    </main>
  );
}
