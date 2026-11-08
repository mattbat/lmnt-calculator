import { useState } from 'react';
import { calculateBatch } from '../calc';
import { IngredientSheet } from '../components/IngredientSheet';
import { Confirm, Empty, Footer, Info, Loading, NumField, TopBar } from '../components/ui';
import { RECIPE_COLORS } from '../color';
import { createRecipe, deleteRecipe, duplicateRecipe, updateRecipe, useIngredients, useRecipes, useSettings } from '../data/repo';
import { mg, money, perServing } from '../format';
import { useRun } from '../hooks/useRun';
import { moveItem } from '../mixSession';
import { navigate, paths } from '../router';
import type { Ingredient, Recipe, Settings } from '../types';

interface DraftLine {
  key: string;
  ingredientId: string;
  gramsPerServing: number | undefined;
}

let keyCounter = 0;
const nextKey = () => `line-${++keyCounter}`;

function EditorBody({
  recipe,
  ingredients,
  settings,
}: {
  recipe: Recipe | undefined;
  ingredients: Ingredient[];
  settings: Settings;
}) {
  const [name, setName] = useState(recipe?.name ?? '');
  const [color, setColor] = useState(recipe?.color ?? RECIPE_COLORS[4]!);
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [lines, setLines] = useState<DraftLine[]>(
    () => recipe?.lines.map((l) => ({ key: nextKey(), ingredientId: l.ingredientId, gramsPerServing: l.gramsPerServing })) ?? [],
  );
  const [newIngredient, setNewIngredient] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formError, setFormError] = useState('');
  const [error, run] = useRun();

  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const unused = ingredients.filter((i) => !lines.some((l) => l.ingredientId === i.id));

  const draft: Recipe = {
    id: recipe?.id ?? 'draft',
    name,
    color,
    lines: lines.map((l) => ({ ingredientId: l.ingredientId, gramsPerServing: l.gramsPerServing ?? 0 })),
    sortOrder: recipe?.sortOrder ?? 0,
    updatedAt: 0,
  };
  const totals = calculateBatch(draft, ingredients, { mode: 'servings', servings: 1 }, settings);

  const addLine = (ingredientId: string) =>
    setLines((ls) => [...ls, { key: nextKey(), ingredientId, gramsPerServing: undefined }]);

  const save = async () => {
    if (!name.trim()) return setFormError('Give the recipe a name.');
    const empty = lines.find((l) => !l.gramsPerServing || l.gramsPerServing <= 0);
    if (empty) return setFormError(`Enter grams per serving for ${byId.get(empty.ingredientId)?.name ?? 'each ingredient'}.`);
    setFormError('');
    const data = {
      name: name.trim(),
      color,
      lines: lines.map((l) => ({ ingredientId: l.ingredientId, gramsPerServing: l.gramsPerServing! })),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    await run(async () => {
      if (recipe) {
        await updateRecipe(recipe.id, { ...data, notes: data.notes });
        navigate(paths.recipe(recipe.id));
      } else {
        const created = await createRecipe(data);
        navigate(paths.recipe(created.id));
      }
    });
  };

  return (
    <main className="screen">
      <TopBar
        title={recipe ? 'Edit recipe' : 'New recipe'}
        back={recipe ? paths.recipe(recipe.id) : paths.recipes()}
        color={color}
      />
      <div className="field">
        <label className="field-label">
          <span>Name</span>
          <span className="input-wrap">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </span>
        </label>
      </div>
      <div className="field">
        <span className="field-label">
          <span id="color-label">Color</span>
        </span>
        <div className="swatches" role="radiogroup" aria-labelledby="color-label">
          {RECIPE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === color}
              aria-label={`Color ${c}`}
              className={c === color ? 'swatch on' : 'swatch'}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      <div className="field">
        <label className="field-label">
          <span>Notes (optional)</span>
          <textarea className="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <h2>
        Ingredients <Info label="grams per serving">Amounts are grams for one serving. They scale together with the batch size.</Info>
      </h2>
      {lines.length === 0 && <Empty title="No ingredients yet">Add an ingredient below, then enter its grams per serving.</Empty>}
      <ul className="lines editor-lines">
        {lines.map((l, i) => {
          const ingredient = byId.get(l.ingredientId);
          return (
            <li key={l.key} className="line">
              <div className="line-main">
                <span className="line-name">
                  {ingredient?.name ?? 'Missing ingredient'}{' '}
                  {ingredient && <span className="muted small">{ingredient.group === 'base' ? 'Base' : 'Flavor'}</span>}
                </span>
              </div>
              <NumField
                label={`Grams per serving: ${ingredient?.name ?? 'ingredient'}`}
                value={l.gramsPerServing}
                onValue={(v) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, gramsPerServing: v } : x)))}
                suffix="g"
                min={0}
              />
              <div className="icon-row">
                <button
                  type="button"
                  className="btn ghost small"
                  aria-label={`Move ${ingredient?.name ?? 'ingredient'} up`}
                  disabled={i === 0}
                  onClick={() => setLines((ls) => moveItem(ls, i, i - 1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn ghost small"
                  aria-label={`Move ${ingredient?.name ?? 'ingredient'} down`}
                  disabled={i === lines.length - 1}
                  onClick={() => setLines((ls) => moveItem(ls, i, i + 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn ghost small danger-text"
                  aria-label={`Remove ${ingredient?.name ?? 'ingredient'}`}
                  onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <label className="field-label">
        <span>Add an ingredient</span>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value === '__new') setNewIngredient(true);
            else if (e.target.value) addLine(e.target.value);
          }}
        >
          <option value="">Choose…</option>
          {unused.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
          <option value="__new">＋ New ingredient…</option>
        </select>
      </label>

      <h2>Per serving</h2>
      <dl className="stats" aria-live="polite">
        <div>
          <dt>Weight</dt>
          <dd className="num">{perServing(totals.totalGrams, settings.weightUnit)}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd className="num">{money(totals.costPerServing)}</dd>
        </div>
        <div>
          <dt>Sodium</dt>
          <dd className="num">{mg(totals.minerals.sodium)}</dd>
        </div>
        <div>
          <dt>Potassium</dt>
          <dd className="num">{mg(totals.minerals.potassium)}</dd>
        </div>
        <div>
          <dt>Magnesium</dt>
          <dd className="num">{mg(totals.minerals.magnesium)}</dd>
        </div>
      </dl>

      {(formError || error) && (
        <p className="form-error" role="alert">
          {formError || error}
        </p>
      )}
      <div className="actions">
        <button type="button" className="btn big" onClick={() => void save()}>
          Save recipe
        </button>
        {recipe && (
          <div className="actions row">
            <button
              type="button"
              className="btn ghost"
              onClick={() =>
                void run(async () => {
                  const copy = await duplicateRecipe(recipe.id);
                  navigate(paths.recipeEdit(copy.id));
                })
              }
            >
              Duplicate
            </button>
            <button type="button" className="btn ghost danger-text" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          </div>
        )}
      </div>
      <Footer />
      {newIngredient && <IngredientSheet onClose={() => setNewIngredient(false)} onSaved={(i) => addLine(i.id)} />}
      {confirmDelete && recipe && (
        <Confirm
          title="Delete recipe?"
          message={`Delete "${recipe.name}"? Batches already in your log are kept.`}
          confirmLabel="Delete recipe"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            void run(async () => {
              await deleteRecipe(recipe.id);
              navigate(paths.recipes());
            });
          }}
        />
      )}
    </main>
  );
}

/** Recipe editor (§9 screen 4). `id` is a recipe id, or "new". */
export function RecipeEditor({ id }: { id: string }) {
  const recipes = useRecipes();
  const ingredients = useIngredients();
  const settings = useSettings();
  if (!recipes || !ingredients || !settings) {
    return (
      <main className="screen">
        <Loading />
      </main>
    );
  }
  const recipe = id === 'new' ? undefined : recipes.find((r) => r.id === id);
  if (id !== 'new' && !recipe) {
    return (
      <main className="screen">
        <TopBar title="Recipe not found" back={paths.recipes()} />
        <Empty title="That recipe no longer exists">
          <a href={paths.recipes()}>Back to recipes</a>
        </Empty>
      </main>
    );
  }
  return <EditorBody key={recipe?.id ?? 'new'} recipe={recipe} ingredients={ingredients} settings={settings} />;
}
