import { useState } from 'react';
import { ouncesToGrams, parsePackageSize, pricePerGram, type PackageUnit } from '../calc';
import { createIngredient, deleteIngredient, updateIngredient, useSettings } from '../data/repo';
import { plain } from '../format';
import { useRun } from '../hooks/useRun';
import type { Ingredient, IngredientGroup } from '../types';
import { Confirm, NumField, Segmented, Sheet } from './ui';

const pct = (fraction: number | undefined) => (fraction === undefined ? undefined : Number((fraction * 100).toFixed(4)));
const fraction = (percent: number | undefined) => (percent && percent > 0 ? Number((percent / 100).toFixed(6)) : undefined);

/** Create or edit an ingredient: package size and price, buy link, electrolytes, grams per tsp (U3, U4). */
export function IngredientSheet({
  ingredient,
  onClose,
  onSaved,
}: {
  ingredient?: Ingredient;
  onClose: () => void;
  onSaved?: (ingredient: Ingredient) => void;
}) {
  const settings = useSettings();
  const [name, setName] = useState(ingredient?.name ?? '');
  const [group, setGroup] = useState<IngredientGroup>(ingredient?.group ?? 'flavor');
  const [pkg, setPkg] = useState<number | undefined>(ingredient ? Number(ingredient.packageGrams.toFixed(1)) : 100);
  const [pkgUnit, setPkgUnit] = useState<PackageUnit>('g');
  const [pkgDirty, setPkgDirty] = useState(!ingredient);
  const [price, setPrice] = useState<number | undefined>(ingredient?.packagePrice ?? 0);
  const [buyUrl, setBuyUrl] = useState(ingredient?.buyUrl ?? '');
  const [sodium, setSodium] = useState(pct(ingredient?.minerals.sodium));
  const [potassium, setPotassium] = useState(pct(ingredient?.minerals.potassium));
  const [magnesium, setMagnesium] = useState(pct(ingredient?.minerals.magnesium));
  const [tsp, setTsp] = useState<number | undefined>(ingredient?.gramsPerTsp);
  const [measured, setMeasured] = useState<number | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, run] = useRun();
  const [formError, setFormError] = useState('');

  const unit = settings?.weightUnit ?? 'g';
  const packageGrams = pkgDirty ? (pkg === undefined ? null : parsePackageSize(pkg, pkgUnit)) : ingredient!.packageGrams;

  const save = async () => {
    if (!name.trim()) return setFormError('Give the ingredient a name.');
    if (packageGrams === null) return setFormError('Enter the package size.');
    if (price === undefined || price < 0) return setFormError('Enter the package price (0 if you are not sure yet).');
    setFormError('');
    const minerals: Ingredient['minerals'] = {};
    const s = fraction(sodium);
    const k = fraction(potassium);
    const m = fraction(magnesium);
    if (s) minerals.sodium = s;
    if (k) minerals.potassium = k;
    if (m) minerals.magnesium = m;
    const data = {
      name: name.trim(),
      group,
      packageGrams,
      packagePrice: price,
      minerals,
      ...(buyUrl.trim() ? { buyUrl: buyUrl.trim() } : {}),
      ...(tsp && tsp > 0 ? { gramsPerTsp: tsp } : {}),
    };
    await run(async () => {
      if (ingredient) {
        // Clear optional fields the user emptied: updateIngredient merges.
        await updateIngredient(ingredient.id, {
          ...data,
          buyUrl: data.buyUrl,
          gramsPerTsp: data.gramsPerTsp,
        });
        onSaved?.({ ...ingredient, ...data, updatedAt: Date.now() });
      } else {
        const created = await createIngredient(data);
        onSaved?.(created);
      }
      onClose();
    });
  };

  const perGram = pricePerGram({ packageGrams: packageGrams ?? 0, packagePrice: price ?? 0 });

  return (
    <Sheet title={ingredient ? `Edit ${ingredient.name}` : 'New ingredient'} onClose={onClose}>
      <div className="field">
        <label className="field-label">
          <span>Name</span>
          <span className="input-wrap">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </span>
        </label>
      </div>
      <Segmented
        label="Group"
        value={group}
        onChange={setGroup}
        options={[
          { value: 'base', label: 'Base (electrolyte)' },
          { value: 'flavor', label: 'Flavor' },
        ]}
      />
      <div className="row-fields">
        <NumField
          label="Package size"
          value={pkg}
          onValue={(v) => {
            setPkg(v);
            setPkgDirty(true);
          }}
          min={0.0001}
        />
        <label className="field-label unit-select">
          <span>Unit</span>
          <select
            value={pkgUnit}
            onChange={(e) => {
              setPkgUnit(e.target.value as PackageUnit);
              setPkgDirty(true);
            }}
          >
            <option value="g">g</option>
            <option value="kg">kg</option>
            <option value="oz">oz</option>
            <option value="lb">lb</option>
          </select>
        </label>
      </div>
      {packageGrams !== null && pkgUnit !== 'g' && <p className="hint">= {plain(packageGrams, 1)} g</p>}
      <NumField label="Package price" value={price} onValue={setPrice} suffix="$" min={0} />
      <p className="hint">{price === 0 ? 'Price not set: costs show as $0 until you enter it. ' : ''}Price per gram: ${perGram.toFixed(4)}</p>
      <div className="field">
        <label className="field-label">
          <span>Buy link (optional)</span>
          <span className="input-wrap">
            <input type="url" inputMode="url" value={buyUrl} onChange={(e) => setBuyUrl(e.target.value)} />
          </span>
        </label>
      </div>
      {ingredient?.buyUrl && /^https?:\/\//.test(ingredient.buyUrl) && (
        <p>
          <a href={ingredient.buyUrl} target="_blank" rel="noopener noreferrer">
            Open buy link
          </a>
        </p>
      )}
      <h3>Electrolyte content (% of weight)</h3>
      <NumField
        label="Sodium"
        value={sodium}
        onValue={setSodium}
        suffix="%"
        min={0}
        info="The share of this ingredient's weight that is sodium. Pure table salt is about 39.3%; check your salt's label."
      />
      <NumField
        label="Potassium"
        value={potassium}
        onValue={setPotassium}
        suffix="%"
        min={0}
        info="Potassium chloride is about 52.4% potassium."
      />
      <NumField
        label="Magnesium"
        value={magnesium}
        onValue={setMagnesium}
        suffix="%"
        min={0}
        info="Magnesium malate is about 15.4% magnesium; di-magnesium malate about 22.6%."
      />
      <NumField
        label="Grams per teaspoon"
        value={tsp}
        onValue={setTsp}
        suffix="g"
        min={0}
        info="Used only for the approximate teaspoon view. Powders vary in density, so weigh when you can."
      />
      <div className="callout">
        <strong>Measure helper</strong>
        <p>Level off 1 teaspoon, put it on the scale, and enter the weight.</p>
        <NumField
          label={`Weight of 1 level tsp (${unit})`}
          value={measured}
          onValue={setMeasured}
          min={0.0001}
          suffix={unit}
        />
        <button
          type="button"
          className="btn small"
          disabled={measured === undefined || measured <= 0}
          onClick={() => {
            if (measured !== undefined) setTsp(Number((unit === 'oz' ? ouncesToGrams(measured) : measured).toFixed(3)));
          }}
        >
          Use as grams per tsp
        </button>
      </div>
      {(formError || error) && (
        <p className="form-error" role="alert">
          {formError || error}
        </p>
      )}
      <div className="actions">
        <button type="button" className="btn" onClick={() => void save()}>
          Save ingredient
        </button>
        {ingredient && (
          <button type="button" className="btn ghost danger-text" onClick={() => setConfirmDelete(true)}>
            Delete ingredient
          </button>
        )}
      </div>
      {confirmDelete && ingredient && (
        <Confirm
          title="Delete ingredient?"
          message={`Delete "${ingredient.name}"? This can't be undone.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            void run(async () => {
              await deleteIngredient(ingredient.id);
              onClose();
            });
          }}
        />
      )}
    </Sheet>
  );
}
