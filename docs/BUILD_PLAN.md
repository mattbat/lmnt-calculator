# Build plan

How v1 is built from `REQUIREMENTS.md`. Each phase is done by one agent; phase 2's two parts run in parallel and touch separate folders. Every phase ends with `npm run check` passing.

## Phase 1: scaffold, CI/CD, test harness

Copy next5's setup (`C:\Users\matth\repos\next5`), renamed for `/lmnt-calculator/`:

- `package.json` scripts and dependencies (same versions as next5), `tsconfig.json`, `eslint.config.js`, `.gitignore`, `vite.config.ts` (base `/lmnt-calculator/`, PWA manifest named "LMNT Calculator", short name "LMNT Calc", vitest config with coverage thresholds: 80% overall, 95% for `src/calc/**`), `playwright.config.ts` (WebKit at iPhone size, Chromium at Android size, a Chromium offline project), `scripts/check.mjs`, `src/test/setup.ts`.
- `.github/workflows/ci.yml`: lint → type-check → unit tests with coverage → build → e2e; deploy to GitHub Pages only on push to `main` after every job passes (Q-6).
- Shared pieces adapted from next5: `src/pwaUpdate.ts`, `src/components/UpdateBanner.tsx`, `src/components/InstallHint.tsx`, `src/components/ErrorBanner.tsx`, `src/errorLog.ts`, `src/hooks/useWakeLock.ts`, `src/data/share.ts` (`shareFile`, `shareLink`), a hash router (`src/router.ts`), `src/theme.ts`.
- An original placeholder icon (`public/favicon.svg` plus generated PNGs via `@vite-pwa/assets-generator`): a simple vial/droplet mark, not LMNT's look.
- A minimal `App.tsx` that renders a tab bar shell, plus one smoke unit test and one smoke e2e test, so the pipeline is green end to end.

## Phase 2a: calculator engine (`src/calc/`) — pure TypeScript

Files: `src/calc/*.ts` and tests only. Imports only `src/types.ts`.

- `defaults.ts`: default ingredients (§5.1), recipes (§5.2) and settings (§5.3), with stable ids (`salt`, `potassium-chloride`, `magnesium-malate`, `malic-acid`, `citric-acid`, `lemon-powder`, `watermelon-powder`, `stevia`; recipes `raw`, `lemon`, `watermelon`).
- `batch.ts`:
  - `gramsPerServing(recipe): number`
  - `resolveServings(size: BatchSize, gramsPerServing: number, servingsPerVial: number): { servings: number; vials: number; leftoverGrams: number }` (C1–C3)
  - `calculateBatch(recipe, ingredients: Ingredient[], size, settings): BatchResult` where `BatchResult` has `servings`, `vials`, `fillGramsPerVial`, `totalGrams`, `lines[]` (`ingredientId`, `name`, `group`, `gramsPerServing`, `batchGrams`, `displayGrams` rounded to precision, `cost`, `lowPrecision` flag per C7, optional `teaspoons`), `costPerBatch`, `costPerServing`, `savingsPerServing`, `savingsPerBatch`, `minerals` (mg per serving), `dailyValue` (% for sodium 2,300 mg and potassium 4,700 mg), `leftoverGrams`, and `missingIngredientIds`.
  - `mixingOrder(lines)` (M4): base ingredients largest first, then flavor smallest first.
- `units.ts`: grams ↔ ounces, package-size parsing from g/kg/oz/lb (U4), `formatTeaspoons(grams, gramsPerTsp)` rounded to kitchen fractions down to ⅛ tsp (U2), rounding to scale precision.
- Tests: reproduce the spreadsheet (`lmnt.xlsx`) numbers — cost/g per ingredient, and for 30 servings Raw ≈ $2.92/batch, Lemon ≈ $5.05, Watermelon ≈ $7.41 (allowing for 0.385 g potassium chloride instead of 0.3833 g); grams per serving 3.275 / 4.735 / 5.295; sodium 950 mg, potassium ≈ 202 mg, magnesium ≈ 60 mg. Property tests with fast-check: linear scaling, totals equal the sum of lines, display rounding never changes cost, the three size modes agree, mixing order is a permutation.

## Phase 2b: data layer (`src/data/`)

Files: `src/data/*.ts` (except `share.ts` from phase 1, which it may extend) and tests only. Imports `src/types.ts` and `src/calc/defaults.ts` (for seeding; coordinate by importing the names listed above).

- `db.ts`: Dexie database `lmnt-calculator`, version 1 with tables `ingredients`, `recipes`, `batches`, `settings` (single row). Seeds defaults on first open. Requests persistent storage.
- `repo.ts`: the only write path for screens. CRUD for ingredients, recipes (including duplicate), batches, and settings (partial update). Every write sets `updatedAt`. Plus React hooks via `dexie-react-hooks` (`useRecipes`, `useIngredients`, `useBatches`, `useSettings`).
- `backup.ts` (B1–B4): export everything to versioned JSON; restore with replace-all or merge (newer `updatedAt` wins); summary before applying; validate input and reject bad files with a clear error.
- `recipeLink.ts` (SH1–SH5): encode a recipe and its ingredients (without prices) to compact JSON, compress with `CompressionStream('deflate-raw')` where available (with a plain fallback), base64url after `#r=`; versioned; decode with validation; `importSharedRecipe` that matches ingredients by name (case-insensitive), creates missing ones without prices, and handles name clashes (replace or keep both as "Name (2)").
- Tests with `fake-indexeddb`: seeding, CRUD, backup round trip (replace and merge), bad backups, link round trip, damaged links, import matching and name clashes.

## Phase 3: screens and e2e

Uses `src/calc` and `src/data/repo.ts` only. Screens from §9: Recipes (home), Calculator, Mixing mode (with wake lock and resume), Recipe editor, Ingredients (with the teaspoon Measure helper), Log and Log entry (notes, optional rating, Make again), Receive recipe, Settings (units, precision, vials, retail price, theme, backup/restore, version, check for updates), About (credit, disclaimer, Buy the real thing, Equipment placeholder), Help. First-launch disclaimer (D1), footer (D2), backup reminder (B3), update prompt held back in mixing mode (T7).

E2E (Playwright, Q-4): make a 30-serving Watermelon batch → mix → log with notes → Make again; share a link → open in a fresh context → add the recipe; back up → clear → restore; offline launch (Chromium project). Component tests for the calculator screen and mixing mode.

Finish with `README.md` (H-1, H-2) and `docs/STATUS.md` filled in.
