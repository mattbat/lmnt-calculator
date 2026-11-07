/**
 * Shared data types (REQUIREMENTS.md §4). All weights are grams; all money is
 * US dollars; all times are epoch milliseconds.
 */

export type Mineral = 'sodium' | 'potassium' | 'magnesium';

/** Fraction (0–1) of the ingredient's weight that is each mineral. */
export type MineralFractions = Partial<Record<Mineral, number>>;

export type IngredientGroup = 'base' | 'flavor';

export interface Ingredient {
  id: string;
  name: string;
  group: IngredientGroup;
  /** Package size in grams (entered in any unit, stored in grams; U4). */
  packageGrams: number;
  packagePrice: number;
  buyUrl?: string;
  minerals: MineralFractions;
  /** Approximate grams in one level teaspoon, for the teaspoon view (U2, U3). */
  gramsPerTsp?: number;
  updatedAt: number;
}

export interface RecipeLine {
  ingredientId: string;
  gramsPerServing: number;
}

export interface Recipe {
  id: string;
  name: string;
  /** CSS color for the recipe's card and headers (§14). */
  color: string;
  notes?: string;
  lines: RecipeLine[];
  /** Position in the Recipes list. */
  sortOrder: number;
  /** True for Raw, Lemon and Watermelon as shipped. */
  builtIn?: boolean;
  updatedAt: number;
}

/** How the user sized the batch (C1–C3). */
export type BatchSize =
  | { mode: 'servings'; servings: number }
  | { mode: 'vials'; vials: number }
  | { mode: 'weight'; grams: number };

export type WeightUnit = 'g' | 'oz';
export type ScalePrecision = 0.01 | 0.1 | 1;
export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Settings {
  /** Retail price per stick for the savings comparison (§5.3). */
  retailPricePerServing: number;
  scalePrecision: ScalePrecision;
  servingsPerVial: number;
  defaultServings: number;
  weightUnit: WeightUnit;
  /** Show approximate teaspoons next to weights (U2). */
  showTeaspoons: boolean;
  theme: ThemeSetting;
  /** Set when the first-launch disclaimer (D1) is acknowledged. */
  disclaimerAcceptedAt?: number;
  lastBackupAt?: number;
  /** Last batch size used per recipe id (C8). */
  lastBatchSize: Record<string, BatchSize>;
}

/** One ingredient line as recorded in the batch log (L1). */
export interface LoggedLine {
  ingredientId: string;
  name: string;
  gramsPerServing: number;
  targetGrams: number;
  actualGrams?: number;
}

export interface BatchLogEntry {
  id: string;
  madeAt: number;
  recipeId: string;
  /** Snapshot of the recipe as it was when the batch was made (§4). */
  recipeSnapshot: { name: string; color: string; lines: RecipeLine[] };
  servings: number;
  vials: number;
  servingsPerVial: number;
  fillGramsPerVial: number;
  lines: LoggedLine[];
  totalCost: number;
  notes: string;
  /** Optional 1–5 (L6). */
  rating?: number;
  updatedAt: number;
}
