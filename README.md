# LMNT Calculator

A phone app for mixing a homemade electrolyte drink powder. Pick one of the built-in recipes and a batch size, and it tells you exactly how many grams of each ingredient to weigh, walks you through weighing them one at a time, and logs the batch with your notes. It also shows what each serving costs, how much sodium, potassium and magnesium it has, and what you save compared with buying ready-made sticks. The recipes and ingredient prices are built in: the app is read-only, and you can't edit or add recipes.

Use it at **https://mattbat.com/lmnt-calculator/**. It works offline once it has loaded, has no accounts or ads, and keeps everything on your device.

- [For users](#for-users)
- [For developers](#for-developers)

---

## For users

### Credit and disclaimer

The base ratios come from the recipe LMNT published at [science.drinklmnt.com](https://science.drinklmnt.com/electrolytes/best-homemade-electrolyte-drink-for-dehydration). LMNT Calculator is a personal, non-commercial project. **It is not made by, endorsed by, or affiliated with LMNT.** LMNT is a trademark of its owner. If you like the real thing, [buy it](https://drinklmnt.com).

**This is not medical advice.** Each serving has about 1,000 mg of sodium. Check with a doctor first if you have kidney disease, high blood pressure, or heart failure, are pregnant, or take medication that affects potassium (for example ACE inhibitors, ARBs, or potassium-sparing diuretics). Store powders away from children: concentrated potassium chloride is harmful in large amounts. You are responsible for your ingredients and your measurements. The app shows this notice on first launch, and the full text is under **More → About**.

### Install it

**iPhone (Safari):** open the link above, tap **Share**, then **Add to Home Screen**. It then opens like an app.

**Android (Chrome):** open the link, tap the **⋮** menu, then **Install app** (or **Add to Home screen**).

Installing is optional, but an installed app keeps its own storage, separate from the browser. Don't mix the two: pick one and stay with it (or use a backup to move data).

### Quick start: make a batch

1. On **Recipes**, tap a recipe (Raw, Lemon and Watermelon come built in).
2. Choose the batch size: **Servings**, **Vials**, or **Weight** of mix. Everything updates instantly.
3. **Start mixing** is right under the batch size. Below it, the **Weigh out** list shows how many grams of each ingredient to measure (switch between grams and ounces there), and a **Summary** card shows the batch weight, the vials, the cost, your savings and the electrolytes.
4. Tap **Start mixing**. For each ingredient: tare the scale, weigh to the target, tap **Done → next**. The screen stays on, and if the phone locks you resume on the same step.
5. After the last ingredient, mix well (break up any clumps), fill the vials, and tap **Finish**. The batch goes to the **Log**, where you can add notes ("a bit sour; try 0.5 g less malic acid").
6. Next time, open the entry and tap **Make again**.

Each serving is meant for 16-32 oz (about 0.5-1 L) of water.

### Recipes and prices are built in

The recipes and ingredient prices come with the app and can't be edited. **Ingredients** is a read-only price list (package size, price, price per gram, and a buy link where there is one). When the recipes or prices change, you get them with the next app update; the app asks before it updates.

### Share a recipe

Open a recipe and tap **Share recipe**. It sends a link to that recipe's page (or copies the link where sharing isn't available). Whoever opens it sees the safety notice once, then the recipe's calculator. The link holds no data about you and never includes your log.

### Back up your data

Your data lives only on your device. It is lost if the app is removed or the browser's site data is cleared. Go to **More → Settings → Back up now** and save the file somewhere safe (the share sheet lets you save to Files or send it to yourself). To restore, choose the file under **Backup and restore**, read the summary, and pick **Merge** (keeps the newer copy of each item) or **Replace all**. Only your batch log and settings are backed up; the recipes and prices are part of the app. The app reminds you if you have logged batches and not backed up for 60 days; tap **Not now** to hide the reminder for 30 days.

---

## For developers

### Stack

React 19 + TypeScript + Vite, `vite-plugin-pwa` (Workbox, `registerType: 'prompt'`), Dexie (IndexedDB). Tests: Vitest + Testing Library + fast-check, Playwright (WebKit at iPhone size, Chromium at Android size, plus an offline Chromium project). No UI library; the whole app is about 125 KB of JS and 3 KB of CSS gzipped.

The requirements are in [REQUIREMENTS.md](REQUIREMENTS.md), the build plan in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md), and per-requirement progress in [docs/STATUS.md](docs/STATUS.md). Working rules are in [CLAUDE.md](CLAUDE.md).

### Layout

```
src/
  calc/         pure TypeScript: batch maths, units, defaults, vial plan (no React/Dexie/DOM)
  data/         db.ts (Dexie schema: batches + settings), repo.ts (the only write path + hooks;
                recipes and ingredients are read from calc/defaults.ts), backup.ts,
                share.ts (share sheet / download, recipePageUrl)
  screens/      one file per screen (Recipes, Calculator, Mixing, Ingredients (read-only),
                Log, LogEntry, Settings, More/About/Help)
  components/   shared UI (sheets, number field, banners, disclaimer gate)
  hooks/        useWakeLock, useRun
  router.ts     tiny hash router (#/recipe/<id>, #/mix/<id>, ...)
  mixSession.ts mixing progress saved in localStorage (resume after reload)
  types.ts      shared types
e2e/            Playwright specs
```

Rules worth knowing: screens write only through `src/data/repo.ts`; all maths comes from `src/calc`; amounts are stored in grams and converted only for display; every URL uses the `/lmnt-calculator/` base; never edit an existing Dexie `version(n)` (add a new one with a migration).

**Recipes and ingredients are code, not data.** Edit `src/calc/defaults.ts` to change a recipe or a price; the next release carries it to every phone. Dexie `version(2)` dropped the old `recipes` and `ingredients` tables, and `useRecipes()`, `useRecipe(id)` and `useIngredients()` in `repo.ts` return the built-in arrays synchronously.

### Setup

```sh
npm ci
npm run dev        # http://localhost:5173/lmnt-calculator/
npm run check      # everything below, in order, stopping at the first failure
```

`npm run check` runs lint, type check, unit tests with coverage (build fails below 80% lines overall and 95% for `src/calc`), the production build, then Playwright against `vite preview`. Individual steps: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` (build first). Install browsers once with `npx playwright install`.

### CI/CD and deployment

`.github/workflows/ci.yml` runs lint, type check, unit tests with coverage, build and e2e on every push and pull request. When all jobs pass on a push to `main`, the build is deployed to GitHub Pages, served at `https://mattbat.com/lmnt-calculator/` through the `mattbat.github.io` custom domain. Hash routing is used because Pages can't fall back to `index.html`. Updates are never applied silently: the service worker waits, and an "update available" banner (hidden during mixing mode) lets the user choose when.

### Share link

`recipePageUrl(id)` in `src/data/share.ts` builds `<origin>/lmnt-calculator/#/recipe/<id>`. The link carries no data, so there is no encoding, versioning or import step: the route renders the built-in recipe, behind the first-launch notice for anyone who hasn't accepted it. `shareLink()` hands it to the share sheet or copies it to the clipboard. Old `#r=...` links from the first version fall through to the Recipes screen.

### Backup format

One JSON file: `{ app: 'lmnt-calculator', format: 2, exportedAt, batches, settings }`. `format` is the layout version; older files are upgraded through `MIGRATIONS` in `src/data/backup.ts` on restore. A format 1 file (which also held recipes and ingredients) still restores: its batches and settings are kept and the rest is ignored. Merge matches by id and keeps the newer `updatedAt`. `settings.backupReminderSnoozedUntil` holds the "Not now" snooze.

### Calculation formulas

All in `src/calc/batch.ts` (grams, US dollars):

- Grams per serving `g = Σ gramsPerServing(line)`.
- Servings `N`: by servings, `N`; by vials `V`, `N = V × servingsPerVial`; by total weight `W`, `N = floor(W / g)` with leftover `W − N·g`.
- Line batch weight `= gramsPerServing × N`, displayed rounded to the scale precision (display only; totals and cost use the unrounded value). A line is flagged low precision when its batch weight is below `10 × precision`.
- Fill per vial `= g × servingsPerVial`. Vials shown are `ceil(N / servingsPerVial)`, with the last, partial vial noted.
- Cost per gram `= packagePrice / packageGrams`; cost per serving `= Σ gramsPerServing × costPerGram`; cost per batch `= cost per serving × N`.
- Savings per serving `= retailPrice − cost per serving`; per batch `= savings per serving × N`.
- Minerals (mg per serving) `= Σ gramsPerServing × fraction × 1000`, with percent of daily value against 2,300 mg sodium and 4,700 mg potassium.
- Mixing order: base ingredients largest first, then flavor ingredients smallest first.
- Units: 1 oz = 28.3495 g.
