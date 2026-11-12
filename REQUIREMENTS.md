# LMNT Calculator — Requirements

**Status:** v0.2 · 2026-11-07 (updated after the first phone test: read-only, built-in recipes; see the decisions log)
**Owner:** Matt
**Primary user:** Matt, at the kitchen counter with a gram scale, mixing a new batch of electrolyte powder on his phone
**Secondary users:** friends Matt shares the app or a recipe with, and anyone who finds it at mattbat.com/lmnt-calculator/

---

## 1. Purpose

LMNT Calculator is a phone app (PWA) for mixing a homemade electrolyte drink powder. It's based on the recipe LMNT published at [science.drinklmnt.com](https://science.drinklmnt.com/electrolytes/best-homemade-electrolyte-drink-for-dehydration), plus Matt's own shelf-stable flavored versions made with fruit powders.

You pick a recipe and a batch size, and the app tells you exactly how many grams of each ingredient to weigh. It then walks you through weighing them one at a time and tells you how much powder goes in each vial (one serving per vial). It also shows what each serving costs, how much sodium, potassium and magnesium it contains, and how much you save compared with buying LMNT. Every batch is logged with notes, so next time you know what you made and how it turned out.

**Read-only by design (2026-11-07).** The recipes and ingredient prices are built into the app. People can't edit, add or delete them. When Matt changes a recipe or a price in the code, every phone gets it on the next update.

It replaces Matt's spreadsheet (`lmnt.xlsx`). Success means Matt never opens the spreadsheet again, never does math while holding a spatula, and can text a friend a link that opens a recipe ready to use.

**Not commercial.** LMNT Calculator is a personal project, like a blog post about using LMNT's published recipe. It isn't sold, has no ads, and is not made by or affiliated with LMNT (see §10).

## 2. Goals and non-goals

### Goals (v1)
- Calculate a batch from either a **number of servings** (one serving fills one vial) or a **total weight of mix**.
- Come with Matt's three built-in recipes (**Raw**, **Lemon**, **Watermelon**). ~~Let users edit them or add their own.~~ *Dropped 2026-11-07: the app is read-only.*
- Store every recipe as **grams per serving** and scale every ingredient together. (This fixes the spreadsheet bug, where the base amounts were typed in for 30 servings and didn't scale.)
- Show cost per batch and per serving from ingredient prices, and savings compared with a retail price per stick.
- Show sodium, potassium and magnesium (mg) per serving.
- Provide a **mixing mode** for weighing, one ingredient at a time, with the screen kept on.
- Keep a **batch log** with notes.
- Let users share a link to a recipe's page.
- Convert units: grams and ounces. (~~Approximate teaspoons~~ dropped 2026-11-07.)
- Show a clear disclaimer and credit LMNT.
- Work fully offline, with backup and restore.

### Non-goals (v1)
- Inventory or stock tracking ("you have enough salt for 4 batches").
- Printable labels.
- Accounts, sync, or any backend.
- Nutrition beyond the three electrolytes (calories, sugars, vitamins).
- Selling anything. Ingredient links are plain links, not affiliate links (see Q4).

### Later (after v1)
- **Equipment page:** the scale, vials, spatulas and other supplies Matt uses, with links. Matt will send the list. v1 includes the page with a placeholder (§9, screen 9).

## 3. Platform and technical constraints

These follow next5 so the two apps share code, tooling and deployment.

| ID | Requirement |
|----|-------------|
| T1 | Delivered as a PWA that can be installed to the home screen (iPhone Safari → Share → Add to Home Screen; Android Chrome → Install) and runs standalone. |
| T2 | Hosted on **GitHub Pages** from a public repo named **`lmnt-calculator`**, which serves it at **https://mattbat.com/lmnt-calculator/** through the existing `mattbat.github.io` custom domain. The landing page in `mattbat.github.io` gets a link to it. |
| T3 | Every config uses the subpath `/lmnt-calculator/`: Vite `base`, manifest `start_url` and `scope`, service-worker scope, and `navigateFallback`. Routing uses hash URLs, because Pages can't fall back to `index.html`. |
| T4 | Works completely offline after the first load. The service worker caches all app files. |
| T5 | All data lives on the device in IndexedDB (Dexie). The app requests persistent storage. |
| T6 | Schema changes use versioned Dexie migrations. An app update never erases data. |
| T7 | Updates are never applied silently. An "Update available" prompt lets the user choose when, and it's held back while mixing mode is open. |
| T8 | Stack: React + TypeScript + Vite, `vite-plugin-pwa` (Workbox), Dexie. Copied from next5: `pwaUpdate.ts`, `UpdateBanner`, `InstallHint`, `useWakeLock`, `share.ts` (`shareFile` / `shareLink`), backup, error banner, Diagnostics. |
| T9 | Targets current iOS Safari and Android Chrome in portrait, at 375–440 pt wide. Desktop browsers work but aren't designed for. |

## 4. Core concepts

- **Ingredient:** something you buy and weigh. It has a name, a package size (grams), a package price, an optional buy link, and its **electrolyte content** (the fraction of its weight that is sodium, potassium and magnesium). Ingredients are built in and read-only.
- **Recipe:** built in and read-only: a name, a color, optional notes, and a list of ingredients, each with **grams per serving**. Ingredients are grouped as **Base** (the electrolytes) or **Flavor** (fruit powder, acid, sweetener), but this is for display only. The math treats every line the same.
- **Serving:** one drink, meant for 16–32 oz of water (from LMNT's guidance).
- **Vial:** a container holding exactly one serving. The fill weight is the grams per serving. (A servings-per-vial setting was dropped 2026-11-09.)
- **Batch:** one mixing session. It's a recipe × a number of servings, with the weight of each ingredient, the cost, and notes. Once logged, a batch keeps a **snapshot** of the recipe as it was, so a later change to a built-in recipe never changes the history.
- **Strength:** not in v1 (see Q3). For a lighter drink you use less powder or more water.

## 5. Built-in data

The recipes and ingredients below live in the code (`src/calc/defaults.ts`), not in the database. They are read-only in the app and change only when an app update ships new values.

### 5.1 Ingredients (from `lmnt.xlsx`)

| Ingredient | Package | Price | $/g | Electrolyte content |
|---|---|---|---|---|
| Redmond Real Salt (sea salt) | 26 oz (737.1 g) | $11.39 | 0.0155 | Sodium **0.38** (check the label, Q1) |
| Potassium chloride | 250 g | $17.97 | 0.0719 | Potassium 0.524 |
| Magnesium malate | 250 g | $19.97 | 0.0799 | Magnesium 0.154 |
| Malic acid | 8 oz (226.8 g) | $8.95 | 0.0395 | — |
| Citric acid | 340 g | $6.99 | 0.0206 | — |
| Lemon powder | 284 g | $11.98 | 0.0422 | — |
| Watermelon juice powder | 250 g | $20.97 | 0.0839 | — |
| Stevia | 4 oz (113.4 g) | $15.99 | 0.1410 | — |

- Electrolyte fractions: pure sodium chloride is 39.3% sodium and potassium chloride is 52.4% potassium (from atomic weights). Magnesium malate is 15.4% magnesium, from LMNT's 390 mg → 60 mg. Redmond Real Salt contains trace minerals, so it is a little under 39.3%. The default is a placeholder until it's checked against the label.
- **Di-magnesium malate** (22.6% magnesium, 0.265 g per serving for 60 mg) is a possible alternative that Matt could add in a later update. It isn't built in.

### 5.2 Recipes (grams per serving)

| Ingredient | Raw | Lemon | Watermelon |
|---|---|---|---|
| Redmond Real Salt | 2.50 | 2.50 | 2.50 |
| Potassium chloride | 0.385 | 0.385 | 0.385 |
| Magnesium malate | 0.39 | 0.39 | 0.39 |
| Lemon powder | — | 1.00 | — |
| Citric acid | — | 0.30 | — |
| Watermelon juice powder | — | — | 1.30 |
| Malic acid | — | — | 0.60 |
| Stevia | — | 0.16 | 0.12 |
| **Grams per serving** | **3.275** | **4.735** | **5.295** |
| **Cost per serving** | **$0.10** | **$0.17** | **$0.25** |
| Sodium / potassium / magnesium (mg) | 950 / 202 / 60 | same | same |

The spreadsheet uses 11.5 g potassium chloride per 30 servings (0.3833 g each). LMNT's per-serving figure is 0.385 g, which gives 11.55 g per 30. The app uses LMNT's figure (see Q2).

### 5.3 Settings defaults
- Retail comparison: **$1.50 per stick** (LMNT lists a 30-count box at $45; about $1.28 with Amazon Subscribe & Save). Editable in Settings.
- Scale precision: **0.01 g**. Editable: 0.01 / 0.1 / 1 g.
- Default batch: **30 servings**.
- Units: **grams**.
- Theme: follows the system (light or dark).

## 6. Calculator

| ID | Requirement |
|----|-------------|
| C1 | **Batch size by servings:** enter N servings. Each ingredient = grams per serving × N. |
| C2 | ~~Batch size by vials~~ (dropped 2026-11-09: a vial is always one serving, so it was the same as servings). |
| C3 | **Batch size by total weight:** enter W grams of mix. N = floor(W ÷ grams per serving), and the app shows the leftover powder. |
| C4 | Every ingredient line shows the batch weight rounded to the scale precision, plus the per-serving weight. Rounding is applied for display only. Totals and cost use the unrounded values. |
| C5 | **Totals:** batch weight, grams per serving, cost per batch, cost per serving, and savings compared with retail are still calculated, but the calculator no longer shows a totals or cost card (decided 2026-11-09). The summary line under the batch size shows servings. |
| C6 | **Electrolytes per serving:** for each mineral, the sum over ingredients of grams per serving × fraction × 1000 (mg), plus its share of the FDA daily value (sodium 2,300 mg, potassium 4,700 mg, magnesium 420 mg). Shown as a nutrition-style label (bold rules, serving size, mg and % DV per row) marked as not an official nutrition label. |
| C7 | **Precision warning:** if any batch weight is less than 10× the scale precision (rounding is off by up to half a step, so below 10× it could be off by more than 5%), mark that line and suggest a bigger batch or a finer scale. Example: on a 0.1 g scale, 10 servings of Watermelon needs 1.2 g of stevia, which is fine. 1 serving needs 0.12 g, which gets a warning. |
| C8 | Changing the batch size or recipe updates everything instantly. Nothing needs saving. The last batch size used for each recipe is remembered. |
| C9 | The calculation is one pure TypeScript module (`src/calc`) with no React, Dexie or DOM imports, so it can be tested on its own (Q-2). |

## 7. Mixing mode

| ID | Requirement |
|----|-------------|
| M1 | Started from the calculator with **Start mixing**, which sits directly under the batch size so it is reachable without scrolling. Shows one ingredient at a time in large type: name, target weight, and a reminder to **tare the scale first**. |
| M2 | **Done → next** moves to the next ingredient. A progress strip shows done and remaining ingredients, and any ingredient can be tapped to jump back. |
| M3 | ~~Optional **actual weight** field for each ingredient, with a flag when more than 5% off.~~ *Dropped 2026-11-07.* Old log entries that recorded actual weights still show them. |
| M4 | Order: Base ingredients first (largest first), then Flavor. Within Flavor, the smallest ingredients go first, so a slip with stevia doesn't waste fruit powder. Users can reorder. |
| M5 | After the last ingredient: a **Mix** step ("Combine and mix thoroughly. Break up any clumps."), then a **Fill** step: "Fill N vials with X g each" (one vial per serving, X = grams per serving) plus any leftover. |
| M6 | The screen stays on during mixing mode (Screen Wake Lock, as in next5). If the phone locks or the app is closed, mixing mode resumes on the same step. |
| M7 | **Finish** saves the batch to the log (§8) and offers a notes field there and then. **Cancel** discards it after confirming. |
| M8 | Tips shown once, and available from Help: weigh on a dry day; fruit powder and malic acid absorb moisture and clump; use sealed vials and a food-safe desiccant pack. |

## 8. Batch log

| ID | Requirement |
|----|-------------|
| L1 | Each entry stores the date, a recipe snapshot (name, color, ingredients and grams per serving), servings, each ingredient's target weight, cost, and **notes**. (Entries made before 2026-11-09 also stored vials and fill weight; those fields are dropped by migration.) (Entries made before 2026-11-07 may also have actual weights, which still show.) |
| L2 | The log lists entries newest first, filterable by recipe. Each row shows the date, recipe, servings, and the first line of the notes. |
| L3 | Notes can be added or edited at any time afterwards ("A bit sour; try 0.5 g malic acid next time"). |
| L4 | **Make again** opens the calculator with that batch's recipe and size. Simplified 2026-11-07: recipes can't be edited, so there is no "recipe changed" choice. If the recipe no longer exists in the app, the entry still shows its snapshot and Make again is hidden. |
| L5 | Entries can be deleted after confirming. Batches can also be logged by hand without mixing mode. |
| L6 | **Optional rating** (1–5) on each entry. See Q5. |

## 9. Screens

1. **Recipes (home):** a card for each built-in recipe showing its color, name, cost per serving, and sodium / potassium / magnesium. (No grams per serving, and no **+ New recipe** or **Paste recipe link**: dropped 2026-11-07.)
2. **Calculator:** for the chosen recipe. Top to bottom: header with the name; batch size (servings / weight); **Start mixing** (with **Share recipe** as a smaller secondary button); the weigh-out list; the compact **Summary** card; the D2 footer. (No **Edit recipe**: dropped.)
3. **Mixing mode** (§7).
4. ~~**Recipe editor**~~ *Dropped 2026-11-07: recipes are built in and read-only.*
5. **Ingredients:** a read-only price list: name, package size, price, price per gram, and buy link if there is one. No edit, add or delete. Bases come first (salt at the top), then flavors.
6. **Log** (§8) and **Log entry**.
7. ~~**Receive recipe**~~ *Dropped 2026-11-07.* A shared link opens the recipe's own page (§11).
8. **Settings:** units, scale precision, retail comparison price, theme, backup and restore, version, and check for updates.
9. **About:** what LMNT Calculator is, a credit and link to LMNT's recipe article, the not-affiliated statement, the full disclaimer (§10), a **Buy the real thing** link to drinklmnt.com, and **Equipment** (a placeholder in v1).
10. **Help:** short topics on making a batch, mixing mode, sharing, backups, and storage tips.

Navigation: a bottom tab bar with **Recipes · Log · Ingredients · More** (Settings, About, Help).

## 10. Disclaimer and credit

| ID | Requirement |
|----|-------------|
| D1 | **First launch:** a one-screen notice that must be acknowledged once: "LMNT Calculator is a personal project, not medical advice. Each serving has about 1,000 mg of sodium. Check with a doctor first if you have kidney disease, high blood pressure, or heart failure, are pregnant, or take medication that affects potassium (for example ACE inhibitors, ARBs, or potassium-sparing diuretics)." |
| D2 | **Every calculator screen** shows a short footer: *"Not medical advice · Not affiliated with LMNT."* It links to About. |
| D3 | **About** has the full text: not medical advice; not made by or affiliated with LMNT; LMNT is a trademark of its owner; the base ratios come from the recipe LMNT published (linked); store powders away from children, since concentrated potassium chloride is harmful in large amounts; the user is responsible for their ingredients and measurements. |
| D4 | **Branding:** LMNT Calculator has its own icon, colors and type, and doesn't copy LMNT's logo, fonts or packaging. |
| D5 | A shared recipe link opens the recipe's calculator, which has the D2 footer. Anyone who hasn't seen the D1 notice gets it first. |

## 11. Sharing

| ID | Requirement |
|----|-------------|
| SH1–SH5 | ~~Recipe links carrying the recipe data (`#r=...`), the Receive screen, Add to my recipes, Copy for the app, and versioned links.~~ *Replaced 2026-11-07 by the row below.* |
| SH | **Share recipe** sends a link to the recipe's own page, `https://mattbat.com/lmnt-calculator/#/recipe/<id>`, with the share sheet (Messages, WhatsApp, email), or copies it to the clipboard where sharing isn't available. Opening it shows the D1 notice the first time, then that recipe's calculator. The link holds no data and no prices. Old `#r=` links just open the Recipes screen. |

## 12. Units

| ID | Requirement |
|----|-------------|
| U1 | The weight display switches between **grams** and **ounces** (1 oz = 28.3495 g). Amounts are always stored in grams. |
| U2 | ~~Teaspoon view with approximate volumes.~~ *Dropped 2026-11-07.* |
| U3 | ~~Measure helper for grams per teaspoon.~~ *Dropped 2026-11-07.* |
| U4 | Package sizes are built in, stored in grams, and shown in the chosen weight unit. (Entering them in other units went with the ingredient editor, 2026-11-07.) |
| U5 | The suggested water per serving is shown as **16–32 oz (about 0.5–1 L)**. |

## 13. Backup

| ID | Requirement |
|----|-------------|
| B1 | **Back up** exports the batch log and settings (recipes and ingredients are built in, so they are not included; backup format 3) to one JSON file through the share sheet, or downloads it where sharing isn't available. Uses next5's `shareFile`. Format 1 files (which also held recipes and ingredients) still restore: their batches and settings are restored and the rest is ignored. Format 2 files (with vials) restore with vial batch sizes turned into servings. |
| B2 | **Restore** from a backup file: **Replace all** or **Merge** (match by ID; the newer `updatedAt` wins). Restore always shows a summary and asks to confirm. |
| B3 | Reminder when the log has entries and there's been no backup in 60 days. **Back up now** goes to Settings; **Not now** hides the reminder for 30 days (added 2026-11-07). |
| B4 | Backups have a format version and are migrated when restored into a newer app. |

> Data is lost if the app is removed from the home screen or the browser's site data is cleared. This is why B1–B3 matter.

## 14. Design and UX

- **Look:** bright, clean and kitchen-friendly, in light and dark themes. Each recipe has a color (Raw: slate, Lemon: yellow, Watermelon: pink-red) used on its card, calculator header and mixing-mode screens. Numbers are big and easy to read from arm's length. The look is LMNT Calculator's own (D4).
- Mixing mode is designed for one hand, possibly with powder on your fingers: tap targets of at least 56 pt, the main button within thumb reach, and no swipe gestures needed.
- Grams use tabular figures so columns line up.
- Respects safe areas and uses `viewport-fit=cover`. No accidental zoom or pull-to-refresh in mixing mode.
- Destructive actions (delete log entry, Replace all) ask for confirmation.
- Accessibility: Dynamic Type, screen-reader labels, and contrast at least WCAG AA in both themes.
- A designed home-screen icon and splash screen. Mockups of the Calculator and Mixing mode are reviewed before the full build.

## 15. Non-functional requirements

| ID | Requirement |
|----|-------------|
| N1 | Opens to a usable screen in under 2 seconds, offline. |
| N2 | Every change is saved immediately. There are no Save buttons. |
| N3 | No analytics, tracking, or network calls other than app updates. |
| N4 | The whole app (JS + CSS) is under 250 KB gzipped, not counting icons. |

### Testing and CI (same approach as next5)

| ID | Requirement |
|----|-------------|
| Q-1 | Every change passes `npm run check` (lint, type-check, unit tests with coverage, build, e2e) before it's committed. |
| Q-2 | **Calculator (`src/calc`):** example tests that reproduce the spreadsheet's numbers for all three recipes (grams, cost and $/g), plus property tests (fast-check) showing that scaling is linear, totals equal the sum of the lines, display rounding never changes cost, the serving and weight modes agree, and electrolyte math matches the fractions. |
| Q-3 | Unit and component tests for the share link (the recipe page URL), backup and restore (replace and merge, formats 1 to 3), migrations (including Dexie v1 to v2 and v2 to v3), and unit conversion. |
| Q-4 | Playwright e2e at iPhone size (WebKit) and Android size (Chromium): open a recipe → set 30 servings → mix → log with notes → Make again; share a link → open it in a new context → see the recipe; Ingredients is read-only; back up → clear → restore; launch offline. |
| Q-5 | Coverage: 95% lines for `src/calc` and 80% overall. The build fails below these. |
| Q-6 | GitHub Actions on every push and PR. Deploying to Pages happens only from `main`, after every job passes (copy next5's `ci.yml`). |

## 16. Documentation

| ID | Requirement |
|----|-------------|
| H-1 | **README for users:** what the app is, the credit and disclaimer, how to install it on iPhone and Android, a quick start (make a batch), sharing, and backups. |
| H-2 | **README for developers:** stack, layout, local setup, tests, deployment, the share-link format, and the calculation formulas. |
| H-3 | Empty states that explain what to do next (an empty log). |
| H-4 | An ⓘ next to scale precision and the comparison price (the ones for electrolyte fractions and grams per tsp went with the editors, 2026-11-07). |
| H-5 | `CLAUDE.md` and `docs/STATUS.md`, as in next5. |

## 17. Decisions log

| Date | Decision |
|------|----------|
| 2026-11-07 | The name is **LMNT Calculator**, at mattbat.com/lmnt-calculator/ (renamed from LMNT-ish the same day). It's non-commercial and credits LMNT, with a not-affiliated statement (§10). |
| 2026-11-07 | The stack, hosting and CI copy next5 (React + TS + Vite + vite-plugin-pwa + Dexie, GitHub Pages, GitHub Actions). |
| 2026-11-07 | Recipes are stored as grams per serving, and every ingredient scales together. |
| 2026-11-07 | v1 includes the batch log with notes, share links, unit conversion, the disclaimer, offline support and backup. |
| 2026-11-07 | No inventory tracking and no labels. |
| 2026-11-07 | Default recipes are Raw, Lemon and Watermelon only. |
| 2026-11-07 | The default retail comparison is $1.50 per stick, editable. |
| 2026-11-07 | The equipment page is a placeholder until Matt sends the list. |
| 2026-11-07 | The app icon is a white drop with a lightning bolt on indigo (`#4f46e5`). Rejected options are kept in `docs/icon-research/`. |
| 2026-11-07 | The app's accent and background tints change from teal to indigo to match the icon. |
| 2026-11-09 | Titles start 16px below the status bar, and the status bar band sits outside the scrolling area, so nothing sits in the haze iOS draws under the clock (as in next5). The update banner moved to the bottom, above the tab bar. |
| 2026-11-09 | **Vials dropped:** a vial always holds one serving, so the Vials batch-size mode and the Servings per vial setting are removed. Dexie `version(3)` and backup format 3 turn saved vial sizes into servings and drop the vial fields from the log (C2, L1). |
| 2026-11-09 | The calculator's Summary card is replaced by a nutrition-style **Electrolytes** label (mg and % daily value per serving); batch weight, vial fill, cost and savings are no longer shown (C5, C6). Ingredients lists bases first, salt at the top. |
| 2026-11-08 | Less scrolling: the app is a fixed-height frame with the tab bar as its bottom row (not position: fixed, which floated above the bottom on iPhone at launch). The calculator, Settings, About and Ingredients are compacted to fit an iPhone 17 screen, and pinch zoom is off. |
| 2026-11-08 | On an installed iPhone app the frame height comes from the screen size, not CSS: at launch iOS reports every CSS height (%, vh, dvh, lvh) about 48pt short, which cut off the tab bar. |
| 2026-11-07 | **Direction change after the first phone test: the app is read-only with built-in recipes.** Recipes and ingredient prices come from `src/calc/defaults.ts`, so an app update changes them everywhere. Dexie `version(2)` drops the recipes and ingredients tables. |
| 2026-11-07 | Removed the recipe editor, **+ New recipe**, duplicate, delete and **Edit recipe** (§9 screen 4). |
| 2026-11-07 | Removed **Paste recipe link**, the Receive screen and the `#r=` link format (SH1–SH5). **Share recipe** now sends a link to the recipe's page (§11). |
| 2026-11-07 | Removed teaspoon amounts, the teaspoon toggle and the Measure helper (U2, U3). |
| 2026-11-07 | Removed the actual-weight field and the 5% flag in mixing mode (M3). The Mix step no longer says to sift. |
| 2026-11-07 | Ingredients is a read-only price list; no edit, add or delete (§9 screen 5). Recipe cards no longer show grams per serving. |
| 2026-11-07 | The calculator shows **Start mixing** directly under the batch size, and a compact **Summary** card replaces the Totals and Electrolytes sections (C5, C6). |
| 2026-11-07 | The backup reminder gets **Not now**, which hides it for 30 days (B3). Backup format 2 holds batches and settings only. |
| 2026-11-07 | **Make again** just opens the calculator at that size; the "recipe has changed" choice is gone (L4). |

## 18. Open questions

| # | Question | Default until decided |
|---|----------|----------------------|
| Q1 | What sodium content does the Redmond Real Salt label give (mg per gram)? | 0.38 (380 mg per g) |
| Q2 | Potassium chloride per serving: 0.385 g (LMNT) or 0.3833 g (the spreadsheet's 11.5 g per 30)? | 0.385 g |
| Q3 | Add a strength setting (full / ¾ / ½) that scales only the Base ingredients? | Not in v1 |
| Q4 | Will the equipment and ingredient links be affiliate links? If so, add a disclosure. | No |
| Q5 | Keep the optional 1–5 rating on log entries, or notes only? | Keep, optional |
| Q6 | Which phone is the main one? | iPhone (as with next5), tested on Android too |
| Q7 | Vial size, and will a vial ever hold more than one serving? | 1 serving per vial |
| Q8 | Scale model and precision? (Part of the equipment list.) | 0.01 g |

## 19. Risks

- **Screen wake lock on iOS home-screen apps** has been unreliable in the past. next5's `useWakeLock` is the starting point. The fallback is a hint to turn off Auto-Lock while mixing.
- **Electrolyte numbers depend on user-entered fractions.** The defaults are documented (§5.1), and sodium for Redmond salt needs checking against the label (Q1).
- **Share links in some messaging apps** can have the `#` part stripped, which would open the Recipes screen instead of the recipe. The link is short, so it is unlikely to be cut off.
- **iOS storage eviction:** rare for installed PWAs. Backup (§13) is the safeguard.
