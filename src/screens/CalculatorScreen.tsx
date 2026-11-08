import { useMemo, useState } from 'react';
import {
  calculateBatch,
  formatWeight,
  gramsPerServing,
  gramsToOunces,
  ouncesToGrams,
  roundToPrecision,
  vialPlan,
} from '../calc';
import { Chip, Footer, Info, Loading, NumField, Section, Segmented, TopBar } from '../components/ui';
import { ShareSheet } from '../components/ShareSheet';
import { setLastBatchSize, updateSettings, useIngredients, useRecipe, useSettings } from '../data/repo';
import { mg, money, perServing } from '../format';
import { clearMixSession, hasMixSession } from '../mixSession';
import { navigate, paths } from '../router';
import type { BatchSize, Ingredient, Recipe, Settings } from '../types';

type Mode = BatchSize['mode'];

const MODE_LABEL: Record<Mode, string> = { servings: 'Servings', vials: 'Vials', weight: 'Weight' };

function sizeValue(size: BatchSize, unit: Settings['weightUnit']): number {
  if (size.mode === 'servings') return size.servings;
  if (size.mode === 'vials') return size.vials;
  return unit === 'oz' ? Number(gramsToOunces(size.grams).toFixed(3)) : size.grams;
}

function CalculatorBody({
  recipe,
  ingredients,
  settings,
}: {
  recipe: Recipe;
  ingredients: Ingredient[];
  settings: Settings;
}) {
  const [size, setSize] = useState<BatchSize>(
    () => settings.lastBatchSize[recipe.id] ?? { mode: 'servings', servings: settings.defaultServings },
  );
  const [sharing, setSharing] = useState(false);
  const unit = settings.weightUnit;
  const precision = settings.scalePrecision;

  const result = useMemo(
    () => calculateBatch(recipe, ingredients, size, settings),
    [recipe, ingredients, size, settings],
  );
  const plan = vialPlan(result, settings.servingsPerVial);

  const change = (next: BatchSize) => {
    setSize(next);
    void setLastBatchSize(recipe.id, next);
  };

  const switchMode = (mode: Mode) => {
    if (mode === size.mode) return;
    if (mode === 'servings') change({ mode, servings: Math.max(1, Math.floor(result.servings)) });
    else if (mode === 'vials') change({ mode, vials: Math.max(1, plan.totalVials) });
    else change({ mode, grams: roundToPrecision(result.totalGrams, precision) || 100 });
  };

  const setAmount = (value: number | undefined) => {
    if (value === undefined || value <= 0) return;
    if (size.mode === 'servings') change({ mode: 'servings', servings: value });
    else if (size.mode === 'vials') change({ mode: 'vials', vials: value });
    else change({ mode: 'weight', grams: unit === 'oz' ? ouncesToGrams(value) : value });
  };

  const startMixing = async (fresh: boolean) => {
    await setLastBatchSize(recipe.id, size);
    if (fresh) clearMixSession(recipe.id);
    navigate(paths.mix(recipe.id));
  };

  const resumable = hasMixSession(recipe.id);
  const fmt = (grams: number) => formatWeight(grams, unit, precision);

  return (
    <main className="screen">
      <TopBar title={recipe.name} back={paths.recipes()} backLabel="Back to recipes" color={recipe.color} />
      <p className="muted">
        {perServing(gramsPerServing(recipe), unit)} per serving · mix one into 16–32 oz (about 0.5–1 L) of water
      </p>

      <Section title="Batch size">
        <Segmented
          label="Batch size by"
          value={size.mode}
          onChange={switchMode}
          options={(['servings', 'vials', 'weight'] as Mode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))}
        />
        <NumField
          label={
            size.mode === 'servings'
              ? 'Number of servings'
              : size.mode === 'vials'
                ? 'Number of vials'
                : `Total weight of mix (${unit})`
          }
          value={sizeValue(size, unit)}
          onValue={setAmount}
          big
          min={0.0001}
          suffix={size.mode === 'weight' ? unit : undefined}
        />
        <p className="summary" aria-live="polite">
          <strong className="num">{Number(result.servings.toFixed(2))}</strong> servings ·{' '}
          <strong className="num">{plan.totalVials}</strong> {plan.totalVials === 1 ? 'vial' : 'vials'}
          {size.mode === 'weight' && result.leftoverGrams > 0 && (
            <>
              {' '}
              · <span className="num">{fmt(result.leftoverGrams)}</span> leftover (not enough for another serving)
            </>
          )}
        </p>
      </Section>

      <Section
        title="Weigh out"
        aside={
          <Segmented
            label="Weight unit"
            value={unit}
            onChange={(weightUnit) => void updateSettings({ weightUnit })}
            options={[
              { value: 'g', label: 'g' },
              { value: 'oz', label: 'oz' },
            ]}
          />
        }
      >
        {result.missingIngredientIds.length > 0 && (
          <p className="form-error" role="alert">
            This recipe uses {result.missingIngredientIds.length} ingredient(s) that no longer exist. Edit the recipe to
            fix it.
          </p>
        )}
        {result.lines.length === 0 ? (
          <p className="muted">This recipe has no ingredients yet. Edit it to add some.</p>
        ) : (
          <ul className="lines">
            {result.lines.map((line) => (
              <li key={line.ingredientId} className="line">
                <div className="line-main">
                  <span className="line-name">{line.name}</span>
                  <span className="line-amount num" data-testid={`amount-${line.ingredientId}`}>
                    {fmt(line.batchGrams)}
                  </span>
                </div>
                <div className="line-sub">
                  <span className="num">{perServing(line.gramsPerServing, unit)}</span> per serving
                  {settings.showTeaspoons && (
                    <>
                      {' · '}
                      <span>{line.teaspoons ? `${line.teaspoons} (approximate)` : 'weigh only'}</span>
                    </>
                  )}
                </div>
                {line.lowPrecision && (
                  <Chip>Low precision: use a bigger batch or a finer scale (rounding could be off by over 5%)</Chip>
                )}
              </li>
            ))}
          </ul>
        )}
        <label className="switch-row">
          <input
            type="checkbox"
            role="switch"
            checked={settings.showTeaspoons}
            onChange={(e) => void updateSettings({ showTeaspoons: e.target.checked })}
          />
          <span>Show approximate teaspoons</span>
        </label>
        {settings.showTeaspoons && (
          <p className="hint">Approximate: powders vary in density, so weigh when you can.</p>
        )}
      </Section>

      <Section title="Totals">
        <dl className="stats">
          <div>
            <dt>Batch weight</dt>
            <dd className="num">{fmt(result.totalGrams)}</dd>
          </div>
          <div>
            <dt>Fill per vial</dt>
            <dd className="num">{fmt(result.fillGramsPerVial)}</dd>
          </div>
          <div>
            <dt>Cost per batch</dt>
            <dd className="num">{money(result.costPerBatch)}</dd>
          </div>
          <div>
            <dt>Cost per serving</dt>
            <dd className="num">{money(result.costPerServing)}</dd>
          </div>
          <div>
            <dt>Saved per serving</dt>
            <dd className="num">{money(result.savingsPerServing)}</dd>
          </div>
          <div>
            <dt>Saved per batch</dt>
            <dd className="num">{money(result.savingsPerBatch)}</dd>
          </div>
        </dl>
        {plan.partialServings > 0 && (
          <p className="hint">
            {plan.totalVials - 1} full {plan.totalVials - 1 === 1 ? 'vial' : 'vials'}, plus a last vial with{' '}
            {Number(plan.partialServings.toFixed(2))} {plan.partialServings === 1 ? 'serving' : 'servings'} (
            {fmt(plan.partialGrams)}).
          </p>
        )}
        <p className="hint">
          Savings compare with ${settings.retailPricePerServing.toFixed(2)} per stick.
          <Info label="comparison price">Change the retail price per stick in Settings.</Info>
        </p>
      </Section>

      <Section title="Electrolytes per serving">
        <dl className="stats">
          <div>
            <dt>Sodium</dt>
            <dd className="num">{mg(result.minerals.sodium)}</dd>
            <dd className="hint">{Math.round(result.dailyValue.sodium)}% daily value</dd>
          </div>
          <div>
            <dt>Potassium</dt>
            <dd className="num">{mg(result.minerals.potassium)}</dd>
            <dd className="hint">{Math.round(result.dailyValue.potassium)}% daily value</dd>
          </div>
          <div>
            <dt>Magnesium</dt>
            <dd className="num">{mg(result.minerals.magnesium)}</dd>
          </div>
        </dl>
      </Section>

      <div className="actions">
        <button type="button" className="btn big" onClick={() => void startMixing(!resumable)} disabled={result.lines.length === 0 || result.servings <= 0}>
          {resumable ? 'Resume mixing' : 'Start mixing'}
        </button>
        {resumable && (
          <button type="button" className="btn ghost" onClick={() => void startMixing(true)}>
            Start over
          </button>
        )}
        <div className="actions row">
          <button type="button" className="btn ghost" onClick={() => setSharing(true)}>
            Share recipe
          </button>
          <a className="btn ghost" href={paths.recipeEdit(recipe.id)}>
            Edit recipe
          </a>
        </div>
      </div>
      <Footer />
      {sharing && <ShareSheet recipe={recipe} ingredients={ingredients} onClose={() => setSharing(false)} />}
    </main>
  );
}

/** Calculator (§9 screen 2, C1–C8). */
export function CalculatorScreen({ id }: { id: string }) {
  const recipe = useRecipe(id);
  const ingredients = useIngredients();
  const settings = useSettings();
  if (!recipe || !ingredients || !settings) {
    // useRecipe gives undefined both while loading and when missing; the live query settles quickly.
    return (
      <main className="screen">
        <TopBar title="Recipe" back={paths.recipes()} />
        <Loading />
        <p className="hint">If this doesn't load, the recipe may have been deleted. <a href={paths.recipes()}>Back to recipes</a></p>
      </main>
    );
  }
  return <CalculatorBody key={recipe.id} recipe={recipe} ingredients={ingredients} settings={settings} />;
}
