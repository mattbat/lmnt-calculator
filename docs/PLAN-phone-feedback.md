# Plan: changes from Matt's phone test (2026-11-07)

Matt tried v1 on his phone. The big change in direction: **LMNT Calculator is a read-only app with built-in recipes**, not a tool for people to make their own. The other changes trim features and tighten the calculator screen.

## Matt's list → what changes

| # | Feedback | Change |
|---|----------|--------|
| 1 | Backup banner can't be dismissed | Add **Not now** to the banner. It snoozes the reminder for 30 days (`settings.backupReminderSnoozedUntil`). **Back up now** stays. |
| 2 | No adding new recipes | Remove **+ New recipe**, the recipe editor, duplicate and delete. |
| 3 | No paste-a-recipe-link sharing | Remove **Paste recipe link**, the Receive screen and the `#r=` link format (`src/data/recipeLink.ts`). Old `#r=` links just open the Recipes screen. |
| 4 | No approximate teaspoons | Remove the teaspoon toggle and teaspoon amounts from the calculator, the Measure helper, `formatTeaspoons`, `settings.showTeaspoons` and `Ingredient.gramsPerTsp`. |
| 5 | Totals and electrolytes take too much room | Replace the two sections with one compact **Summary** card (layout below). |
| 6 | Start mixing should be near the top | Move **Start mixing** directly under the batch size, above the weigh-out list. |
| 7 | Share recipe should link to this page | **Share recipe** shares `https://mattbat.com/lmnt-calculator/#/recipe/<id>` through the share sheet (copy to clipboard where sharing isn't available). Opening it shows the disclaimer the first time, then that recipe's calculator. |
| 8 | No editing recipes | Remove **Edit recipe** (covered by 2). |
| 9 | No actual weight in mixing | Remove the actual-weight field and the >5% flag (`weightDeviation`, `DEVIATION_FLAG`). |
| 10 | No "sift the fruit powder" | The Mix step says "Combine and mix thoroughly. Break up any clumps." |
| 11 | No editing or deleting ingredients | The Ingredients tab becomes a **read-only price list**: name, package size, price, price per gram, and buy link if any. No edit sheet, no add, no delete. |
| 12 | No g per serving on recipe cards | Recipe cards show the name, cost per serving and electrolytes only. |

## Knock-on changes

- **Recipes and ingredients come from code, not the database.** They are read straight from `src/calc/defaults.ts`. This way, when Matt changes a recipe or price in the code, every phone gets the new values on the next update. A copy seeded into each phone's database would never change.
  - **Dexie `version(2)`** drops the `recipes` and `ingredients` tables (`version(1)` stays as it is) and keeps `batches` and `settings`. A migration test opens a v1 database containing batches and settings and checks that nothing in them is lost.
  - **`repo.ts`:** recipe and ingredient CRUD goes. `useRecipes()`, `useRecipe(id)` and `useIngredients()` stay with the same names and return the built-in data, so screens change as little as possible.
- **Backup format 2** holds only batches and settings. Restoring a format 1 file still works: batches and settings are restored, and the recipes and ingredients in it are ignored.
- **Make again** simply opens the calculator at that batch's size. The "recipe has changed" choice goes, since recipes can't be edited. If a logged batch's recipe no longer exists in the code, the entry still shows its snapshot and Make again is hidden.
- **Logged batches** no longer record actual weights. Old entries that have them still display.
- **Kept:** the batch log with notes and rating, logging a batch by hand, backup and restore, the g/oz toggle, scale precision, servings per vial, the retail price setting, the disclaimer, About, Help and the Equipment placeholder.

## New calculator layout (top to bottom)

1. Header in the recipe's color, with the name and "mix one into 16–32 oz of water".
2. **Batch size**: Servings / Vials / Weight, the number field, and the line "30 servings · 30 vials".
3. **Start mixing** (full-width primary button; "Resume mixing" when there's one in progress) and **Share** (smaller secondary button) on the same row or directly under it.
4. **Weigh out**: the ingredient lines, with the g/oz toggle and low-precision chips.
5. **Summary** card, about a third of the old height:
   - Row 1, three stats side by side: **158.85 g** batch · **30 × 5.30 g** vials · **$7.41** batch.
   - Row 2: **$0.25 / serving** · **save $1.25 a serving ($37.59 a batch)** vs $1.50 retail ⓘ.
   - Row 3, electrolyte chips: **Na 950 mg · 41%** · **K 202 mg · 4%** · **Mg 60 mg**.
6. Footer: "Not medical advice · Not affiliated with LMNT."

## Work split

**Agent A: data, calc and types** (first)
- `src/types.ts`: remove `Ingredient.gramsPerTsp` and `Settings.showTeaspoons`; add `Settings.backupReminderSnoozedUntil?: number`.
- `src/calc`: remove `formatTeaspoons` and teaspoon fields from `BatchResult`; remove `weightDeviation` and `DEVIATION_FLAG`; drop `gramsPerTsp` from defaults; keep coverage at 95% or more.
- `src/data`:
  - Dexie v2 with the migration test.
  - `repo.ts` trimmed and its hooks reading from defaults.
  - Backup format 2, restoring format 1.
  - Delete `recipeLink.ts` and its tests.
  - `needsBackupReminder` respects the snooze, and a `snoozeBackupReminder()` writes it.
  - Add `recipePageUrl(id, baseUrl?)`.
- Leaves the UI compiling. Screens that use removed functions may be stubbed minimally, and Agent B finishes them.

**Agent B: screens, tests and docs** (after A)
- Every UI item in the table and the layout above.
- Delete `RecipeEditor`, `ReceiveScreen`, `IngredientSheet`, the paste-link sheet, and their routes and tests.
- Component tests: banner dismiss, share URL, the calculator's order (Start mixing comes before Weigh out), the compact summary values, the read-only Ingredients list, and the mixing steps without actual weight.
- E2E: update the flows. Batch → log → Make again stays. Share now checks that the link is `#/recipe/watermelon` and that opening it in a fresh context shows the disclaimer and then the Watermelon calculator. Backup/restore stays. The price-edit flow becomes "Ingredients shows prices, read-only".
- Update `REQUIREMENTS.md` (decisions log, and mark the dropped requirements), `docs/STATUS.md` and `README.md`.

`npm run check` must pass at the end of each agent's work.
