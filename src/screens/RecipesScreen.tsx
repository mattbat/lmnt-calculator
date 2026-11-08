import { useMemo, useState, type CSSProperties } from 'react';
import { calculateBatch, gramsPerServing } from '../calc';
import { BackupReminder } from '../components/BackupReminder';
import { InstallHint } from '../components/InstallHint';
import { Empty, Footer, Loading, Sheet } from '../components/ui';
import { readableInk } from '../color';
import { useIngredients, useRecipes, useSettings } from '../data/repo';
import { mg, money, perServing, recipeFragment } from '../format';
import { navigate, paths } from '../router';

function PasteSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const open = () => {
    const fragment = recipeFragment(text);
    if (!fragment) return setError("That doesn't look like a recipe link. It should contain #r=…");
    onClose();
    navigate(`#${fragment}`);
  };
  return (
    <Sheet title="Paste recipe link" onClose={onClose}>
      <p>Paste a link someone sent you (or one copied from the browser version of this app).</p>
      <textarea
        className="link-box"
        aria-label="Recipe link"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="button" className="btn" disabled={!text.trim()} onClick={open}>
          Open recipe
        </button>
      </div>
    </Sheet>
  );
}

/** Home (§9 screen 1): a card per recipe. */
export function RecipesScreen() {
  const recipes = useRecipes();
  const ingredients = useIngredients();
  const settings = useSettings();
  const [pasting, setPasting] = useState(false);

  const cards = useMemo(() => {
    if (!recipes || !ingredients || !settings) return undefined;
    return recipes.map((recipe) => ({
      recipe,
      result: calculateBatch(recipe, ingredients, { mode: 'servings', servings: 1 }, settings),
    }));
  }, [recipes, ingredients, settings]);

  return (
    <main className="screen">
      <h1>Recipes</h1>
      <InstallHint />
      <BackupReminder />
      {!cards || !settings ? (
        <Loading />
      ) : cards.length === 0 ? (
        <Empty title="No recipes yet">Tap “New recipe” to make your first one, or paste a recipe link someone sent you.</Empty>
      ) : (
        <ul className="cards">
          {cards.map(({ recipe, result }) => (
            <li key={recipe.id}>
              <a
                className="card recipe-card"
                href={paths.recipe(recipe.id)}
                style={{ '--band': recipe.color, '--band-ink': readableInk(recipe.color) } as CSSProperties}
              >
                <span className="card-band">
                  <span className="card-name">{recipe.name}</span>
                  <span className="card-sub">{perServing(gramsPerServing(recipe), settings.weightUnit)} per serving</span>
                </span>
                <span className="card-body">
                  <span className="big-num">{money(result.costPerServing)}</span>
                  <span className="muted"> per serving</span>
                  <span className="minerals">
                    Na {mg(result.minerals.sodium)} · K {mg(result.minerals.potassium)} · Mg {mg(result.minerals.magnesium)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="actions row">
        <a className="btn" href={paths.newRecipe()}>
          + New recipe
        </a>
        <button type="button" className="btn ghost" onClick={() => setPasting(true)}>
          Paste recipe link
        </button>
      </div>
      <Footer />
      {pasting && <PasteSheet onClose={() => setPasting(false)} />}
    </main>
  );
}
