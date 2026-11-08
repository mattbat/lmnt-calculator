import { useEffect, useMemo, useState } from 'react';
import { calculateBatch, gramsPerServing } from '../calc';
import { Footer, Loading, TopBar } from '../components/ui';
import {
  decodeRecipeLink,
  findRecipeClash,
  importSharedRecipe,
  type ImportResult,
  type SharedRecipe,
} from '../data/recipeLink';
import { useIngredients, useSettings } from '../data/repo';
import { mg, perServing } from '../format';
import { useRun } from '../hooks/useRun';
import { paths } from '../router';
import type { Ingredient, Recipe } from '../types';

type Decoded = { state: 'loading' } | { state: 'error'; error: string } | { state: 'ok'; recipe: SharedRecipe };

/** Receive recipe (§11, §9 screen 7): preview a shared recipe and add it. */
export function ReceiveScreen({ data }: { data: string }) {
  const settings = useSettings();
  const ingredients = useIngredients();
  const [decoded, setDecoded] = useState<Decoded>({ state: 'loading' });
  const [clash, setClash] = useState<Recipe | undefined>();
  const [result, setResult] = useState<ImportResult | undefined>();
  const [copied, setCopied] = useState('');
  const [error, run] = useRun();

  useEffect(() => {
    let alive = true;
    void decodeRecipeLink(`#r=${data}`).then(async (r) => {
      if (!alive) return;
      if (!r.ok) return setDecoded({ state: 'error', error: r.error });
      setClash(await findRecipeClash(r.recipe));
      setDecoded({ state: 'ok', recipe: r.recipe });
    });
    return () => {
      alive = false;
    };
  }, [data]);

  const preview = useMemo(() => {
    if (decoded.state !== 'ok' || !settings) return undefined;
    const shared = decoded.recipe;
    const ing: Ingredient[] = shared.lines.map((l, i) => ({
      id: `s${i}`,
      name: l.ingredient.name,
      group: l.ingredient.group,
      packageGrams: 100,
      packagePrice: 0,
      minerals: l.ingredient.minerals,
      ...(l.ingredient.gramsPerTsp ? { gramsPerTsp: l.ingredient.gramsPerTsp } : {}),
      updatedAt: 0,
    }));
    const recipe: Recipe = {
      id: 'preview',
      name: shared.name,
      color: shared.color,
      lines: shared.lines.map((l, i) => ({ ingredientId: `s${i}`, gramsPerServing: l.gramsPerServing })),
      sortOrder: 0,
      updatedAt: 0,
    };
    return { recipe, result: calculateBatch(recipe, ing, { mode: 'servings', servings: 1 }, settings) };
  }, [decoded, settings]);

  if (decoded.state === 'loading' || !settings || !ingredients) {
    return (
      <main className="screen">
        <TopBar title="Shared recipe" />
        <Loading />
      </main>
    );
  }

  if (decoded.state === 'error') {
    return (
      <main className="screen">
        <TopBar title="Shared recipe" back={paths.recipes()} backLabel="Back to recipes" />
        <p className="form-error" role="alert">
          {decoded.error}
        </p>
        <div className="actions">
          <a className="btn" href={paths.recipes()}>
            Go to my recipes
          </a>
        </div>
        <Footer />
      </main>
    );
  }

  const shared = decoded.recipe;
  const known = new Set(ingredients.map((i) => i.name.trim().toLowerCase()));
  const link = `${location.origin}${location.pathname}#r=${data}`;

  const add = (mode: 'replace' | 'keepBoth') =>
    run(async () => {
      setResult(await importSharedRecipe(shared, mode));
    });

  const copyForApp = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied('Link copied. Open the installed app, then use Recipes → Paste recipe link.');
    } catch {
      setCopied('Could not copy automatically. Select and copy the address of this page instead.');
    }
  };

  if (result) {
    return (
      <main className="screen">
        <TopBar title="Recipe added" color={result.recipe.color} />
        <p className="big-note">
          {result.replaced ? 'Replaced' : 'Added'} <strong>{result.recipe.name}</strong>.
        </p>
        {result.createdIngredients.length > 0 && (
          <div className="callout">
            <strong>Set the prices</strong>
            <p>
              These ingredients were new to you, so their price is not set yet: {result.createdIngredients.join(', ')}.
              Until you enter prices, costs show as $0.
            </p>
            <a className="link" href={paths.ingredients()}>
              Open Ingredients
            </a>
          </div>
        )}
        <div className="actions">
          <a className="btn big" href={paths.recipe(result.recipe.id)}>
            Open {result.recipe.name}
          </a>
          <a className="btn ghost" href={paths.recipes()}>
            Go to my recipes
          </a>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main className="screen">
      <TopBar title={shared.name} back={paths.recipes()} backLabel="Back to recipes" color={shared.color} />
      <p className="muted">A recipe someone shared with you. Nothing is saved until you add it.</p>
      <ul className="lines">
        {shared.lines.map((l, i) => (
          <li key={i} className="line">
            <div className="line-main">
              <span className="line-name">{l.ingredient.name}</span>
              <span className="line-amount num">{perServing(l.gramsPerServing, settings.weightUnit)}</span>
            </div>
            <div className="line-sub">
              per serving · {known.has(l.ingredient.name.trim().toLowerCase()) ? 'you have this ingredient' : 'new ingredient: price not set'}
            </div>
          </li>
        ))}
      </ul>
      {shared.notes && <p className="note-line">{shared.notes}</p>}
      {preview && (
        <dl className="stats">
          <div>
            <dt>Per serving</dt>
            <dd className="num">{perServing(gramsPerServing(preview.recipe), settings.weightUnit)}</dd>
          </div>
          <div>
            <dt>Sodium</dt>
            <dd className="num">{mg(preview.result.minerals.sodium)}</dd>
          </div>
          <div>
            <dt>Potassium</dt>
            <dd className="num">{mg(preview.result.minerals.potassium)}</dd>
          </div>
          <div>
            <dt>Magnesium</dt>
            <dd className="num">{mg(preview.result.minerals.magnesium)}</dd>
          </div>
        </dl>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {clash ? (
        <>
          <p className="callout">
            You already have a recipe called <strong>{clash.name}</strong>.
          </p>
          <div className="actions">
            <button type="button" className="btn big" onClick={() => void add('keepBoth')}>
              Keep both
            </button>
            <button type="button" className="btn ghost" onClick={() => void add('replace')}>
              Replace
            </button>
          </div>
        </>
      ) : (
        <div className="actions">
          <button type="button" className="btn big" onClick={() => void add('keepBoth')}>
            Add to my recipes
          </button>
        </div>
      )}
      <div className="callout">
        <strong>Using the installed app?</strong>
        <p>
          The installed app keeps its own storage, separate from the browser. Copy this recipe, then paste it in the app.
        </p>
        <button type="button" className="btn ghost small" onClick={() => void copyForApp()}>
          Copy for the LMNT Calculator app
        </button>
        {copied && <p role="status">{copied}</p>}
      </div>
      <p className="hint">
        New to this? <a href={paths.about()}>Read the safety notice</a> before you mix anything.
      </p>
      <Footer />
    </main>
  );
}

