import { useState } from 'react';
import { formatWeight, pricePerGram } from '../calc';
import { IngredientSheet } from '../components/IngredientSheet';
import { Chip, Empty, Loading } from '../components/ui';
import { useIngredients, useSettings } from '../data/repo';
import { money } from '../format';
import type { Ingredient } from '../types';

/** The price list (§9 screen 5). */
export function IngredientsScreen() {
  const ingredients = useIngredients();
  const settings = useSettings();
  const [editing, setEditing] = useState<Ingredient | 'new' | undefined>();

  return (
    <main className="screen">
      <h1>Ingredients</h1>
      <p className="muted">Prices here drive every cost and savings number.</p>
      {!ingredients || !settings ? (
        <Loading />
      ) : ingredients.length === 0 ? (
        <Empty title="No ingredients yet">Add the powders you buy, with their package size and price.</Empty>
      ) : (
        <ul className="cards">
          {ingredients.map((i) => (
            <li key={i.id}>
              <button type="button" className="card ingredient-card" onClick={() => setEditing(i)} aria-label={`Edit ${i.name}`}>
                <span className="line-main">
                  <span className="line-name">{i.name}</span>
                  <span className="muted small">{i.group === 'base' ? 'Base' : 'Flavor'}</span>
                </span>
                <span className="line-sub">
                  {formatWeight(i.packageGrams, settings.weightUnit, settings.scalePrecision === 1 ? 1 : 0.1)} package ·{' '}
                  {money(i.packagePrice)} · <span className="num">${pricePerGram(i).toFixed(4)}</span>/g
                </span>
                {i.packagePrice === 0 && <Chip>Price not set</Chip>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="actions">
        <button type="button" className="btn" onClick={() => setEditing('new')}>
          + Add ingredient
        </button>
      </div>
      {editing && (
        <IngredientSheet
          key={editing === 'new' ? 'new' : editing.id}
          ingredient={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </main>
  );
}
