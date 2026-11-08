import { vialPlan, type BatchResult } from './calc';
import type { BatchInput } from './data/repo';
import type { Recipe, Settings } from './types';

/**
 * Turns a calculated batch into a log entry (L1), with a snapshot of the
 * recipe so later edits never change the history. `order` lists ingredient
 * ids in the order they were weighed.
 */
export function buildBatchInput(args: {
  recipe: Pick<Recipe, 'id' | 'name' | 'color' | 'lines'>;
  result: BatchResult;
  settings: Pick<Settings, 'servingsPerVial'>;
  order?: string[];
  notes?: string;
  madeAt?: number;
}): BatchInput {
  const { recipe, result, settings } = args;
  const byId = new Map(result.lines.map((l) => [l.ingredientId, l]));
  const ids = (args.order ?? result.lines.map((l) => l.ingredientId)).filter((id) => byId.has(id));
  return {
    madeAt: args.madeAt ?? Date.now(),
    recipeId: recipe.id,
    recipeSnapshot: { name: recipe.name, color: recipe.color, lines: recipe.lines.map((l) => ({ ...l })) },
    servings: result.servings,
    vials: vialPlan(result, settings.servingsPerVial).totalVials,
    servingsPerVial: settings.servingsPerVial,
    fillGramsPerVial: result.fillGramsPerVial,
    lines: ids.map((id) => {
      const line = byId.get(id)!;
      return {
        ingredientId: id,
        name: line.name,
        gramsPerServing: line.gramsPerServing,
        targetGrams: line.batchGrams,
      };
    }),
    totalCost: result.costPerBatch,
    notes: args.notes ?? '',
  };
}
