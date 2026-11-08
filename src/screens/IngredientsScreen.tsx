import { formatWeight, pricePerGram } from '../calc';
import { Chip, Empty, Loading } from '../components/ui';
import { useIngredients, useSettings } from '../data/repo';
import { money } from '../format';

/** The price list (§9 screen 5). */
export function IngredientsScreen() {
  const ingredients = useIngredients();
  const settings = useSettings();

  return (
    <main className="screen">
      <h1>Ingredients</h1>
      <p className="muted">Prices here drive every cost and savings number.</p>
      {!ingredients || !settings ? (
        <Loading />
      ) : ingredients.length === 0 ? (
        <Empty title="No ingredients">There are no ingredients in this version of the app.</Empty>
      ) : (
        <ul className="cards">
          {ingredients.map((i) => (
            <li key={i.id}>
              <div className="card ingredient-card">
                <span className="line-main">
                  <span className="line-name">{i.name}</span>
                  <span className="muted small">{i.group === 'base' ? 'Base' : 'Flavor'}</span>
                </span>
                <span className="line-sub">
                  {formatWeight(i.packageGrams, settings.weightUnit, settings.scalePrecision === 1 ? 1 : 0.1)} package ·{' '}
                  {money(i.packagePrice)} · <span className="num">${pricePerGram(i).toFixed(4)}</span>/g
                </span>
                {i.packagePrice === 0 && <Chip>Price not set</Chip>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
