import { useMemo, type CSSProperties } from 'react';
import { calculateBatch } from '../calc';
import { BackupReminder } from '../components/BackupReminder';
import { InstallHint } from '../components/InstallHint';
import { Empty, Footer, Loading } from '../components/ui';
import { readableInk } from '../color';
import { useIngredients, useRecipes, useSettings } from '../data/repo';
import { mg, money } from '../format';
import { paths } from '../router';

/** Home (§9 screen 1): a card per recipe. */
export function RecipesScreen() {
  const recipes = useRecipes();
  const ingredients = useIngredients();
  const settings = useSettings();

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
        <Empty title="No recipes">There are no recipes in this version of the app.</Empty>
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
      <Footer />
    </main>
  );
}
