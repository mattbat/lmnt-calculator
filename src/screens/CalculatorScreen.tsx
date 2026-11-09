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
import { Chip, Footer, Loading, NumField, Section, Segmented, TopBar } from '../components/ui';
import { recipePageUrl, shareLink } from '../data/share';
import { setLastBatchSize, updateSettings, useIngredients, useRecipe, useSettings } from '../data/repo';
import { mg, perServing } from '../format';
import { clearMixSession, hasMixSession } from '../mixSession';
import { navigate, paths } from '../router';
import type { BatchSize, Ingredient, Mineral, Recipe, Settings } from '../types';

type Mode = BatchSize['mode'];

const NUTRI_ROWS: [Mineral, string][] = [
  ['sodium', 'Sodium'],
  ['potassium', 'Potassium'],
  ['magnesium', 'Magnesium'],
];

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
  const [shareMessage, setShareMessage] = useState('');
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

  const share = async () => {
    const outcome = await shareLink(recipePageUrl(recipe.id), `${recipe.name} electrolyte mix`, `${recipe.name} on LMNT Calculator`);
    setShareMessage(
      outcome === 'copied' ? 'Link copied.' : outcome === 'failed' ? 'Could not share the link.' : outcome === 'shared' ? 'Shared.' : '',
    );
  };

  const resumable = hasMixSession(recipe.id);
  const fmt = (grams: number) => formatWeight(grams, unit, precision);

  return (
    <main className="screen">
      <TopBar title={recipe.name} back={paths.recipes()} backLabel="Back to recipes" color={recipe.color} />

      <section className="size-block" aria-label="Batch size">
        <div className="size-row">
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
            hideLabel
            value={sizeValue(size, unit)}
            onValue={setAmount}
            big
            min={0.0001}
            suffix={size.mode === 'weight' ? unit : undefined}
          />
        </div>
        <p className="summary" aria-live="polite">
          <strong className="num">{Number(result.servings.toFixed(2))}</strong> servings ·{' '}
          <strong className="num">{plan.totalVials}</strong> {plan.totalVials === 1 ? 'vial' : 'vials'}
          {size.mode === 'weight' && result.leftoverGrams > 0 && (
            <>
              {' '}
              · <span className="num">{fmt(result.leftoverGrams)}</span> leftover
            </>
          )}
          <span className="muted"> · one per 16–32 oz water</span>
        </p>
      </section>

      <div className="start-actions">
        <div className="start-row">
          <button type="button" className="btn big" onClick={() => void startMixing(!resumable)} disabled={result.lines.length === 0 || result.servings <= 0}>
            {resumable ? 'Resume mixing' : 'Start mixing'}
          </button>
          <button type="button" className="btn ghost share-btn" aria-label="Share recipe" onClick={() => void share()}>
            Share
          </button>
        </div>
        {resumable && (
          <button type="button" className="link" onClick={() => void startMixing(true)}>
            Start over
          </button>
        )}
        {shareMessage && (
          <p className="hint" role="status">
            {shareMessage}
          </p>
        )}
      </div>

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
            This recipe uses {result.missingIngredientIds.length} ingredient(s) that no longer exist.
          </p>
        )}
        {result.lines.length === 0 ? (
          <p className="muted">This recipe has no ingredients.</p>
        ) : (
          <ul className="lines">
            {result.lines.map((line) => (
              <li key={line.ingredientId} className="line">
                <div className="line-main">
                  <span className="line-name">
                    {line.name}{' '}
                    <span className="line-sub">
                      <span className="num">{perServing(line.gramsPerServing, unit)}</span>/serving
                    </span>
                  </span>
                  <span className="line-amount num" data-testid={`amount-${line.ingredientId}`}>
                    {fmt(line.batchGrams)}
                  </span>
                </div>
                {line.lowPrecision && (
                  <Chip>Low precision: use a bigger batch or a finer scale (rounding could be off by over 5%)</Chip>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <section className="nutri" aria-label="Electrolytes per serving">
        <h2 className="nutri-title">Electrolytes</h2>
        <p className="nutri-serving">
          <span>
            Per serving <span className="num">{perServing(gramsPerServing(recipe), unit)}</span>
          </span>
          <span className="nutri-dv">% Daily Value*</span>
        </p>
        <dl className="nutri-rows">
          {NUTRI_ROWS.map(([key, name]) => (
            <div key={key} className="nutri-row">
              <dt>
                <strong>{name}</strong> <span className="num">{mg(result.minerals[key])}</span>
              </dt>
              <dd className="num">{Math.round(result.dailyValue[key])}%</dd>
            </div>
          ))}
        </dl>
        <p className="nutri-note">*FDA adult daily values. Not an official nutrition label.</p>
      </section>

      <Footer />
    </main>
  );
}

/** Calculator (§9 screen 2, C1–C8). */
export function CalculatorScreen({ id }: { id: string }) {
  const recipe = useRecipe(id);
  const ingredients = useIngredients();
  const settings = useSettings();
  if (!recipe || !ingredients || !settings) {
    return (
      <main className="screen">
        <TopBar title="Recipe" back={paths.recipes()} />
        {settings ? (
          <p className="hint">
            There is no recipe with that link. <a href={paths.recipes()}>Back to recipes</a>
          </p>
        ) : (
          <Loading />
        )}
      </main>
    );
  }
  return <CalculatorBody key={recipe.id} recipe={recipe} ingredients={ingredients} settings={settings} />;
}
