# LMNT-ish — Requirements

**Status:** Draft v0.1 · 2026-11-07
**Owner:** Matt
**Primary user:** Matt, at the kitchen counter with a gram scale, mixing a new batch of electrolyte powder on his phone
**Secondary users:** friends Matt shares the app or a recipe with, and anyone who finds it at mattbat.com/lmnt-ish/

---

## 1. Purpose

LMNT-ish is a phone app (PWA) for mixing a homemade electrolyte drink powder. It's based on the recipe LMNT published at [science.drinklmnt.com](https://science.drinklmnt.com/electrolytes/best-homemade-electrolyte-drink-for-dehydration), plus Matt's own shelf-stable flavored versions made with fruit powders.

You pick a recipe and a batch size, and the app tells you exactly how many grams of each ingredient to weigh. It then walks you through weighing them one at a time and tells you how much powder goes in each vial. It also shows what each serving costs, how much sodium, potassium and magnesium it contains, and how much you save compared with buying LMNT. Every batch is logged with notes, so next time you know what you made and how it turned out.

It replaces Matt's spreadsheet (`lmnt.xlsx`). Success means Matt never opens the spreadsheet again, never does math while holding a spatula, and can text a friend a recipe that opens ready to use.

**Not commercial.** LMNT-ish is a personal project, like a blog post about using LMNT's published recipe. It isn't sold, has no ads, and is not made by or affiliated with LMNT (see §10).

## 2. Goals and non-goals

### Goals (v1)
- Calculate a batch from any of three sizes: a **number of servings**, a **number of vials**, or a **total weight of mix**.
- Come with Matt's three recipes (**Raw**, **Lemon**, **Watermelon**), and let users edit them or add their own.
- Store every recipe as **grams per serving** and scale every ingredient together. (This fixes the spreadsheet bug, where the base amounts were typed in for 30 servings and didn't scale.)
- Show cost per batch and per serving from ingredient prices, and savings compared with a retail price per stick.
- Show sodium, potassium and magnesium (mg) per serving.
- Provide a **mixing mode** for weighing, one ingredient at a time, with the screen kept on.
- Keep a **batch log** with notes.
- Let users share a recipe as a link.
- Convert units: grams, ounces, and approximate teaspoons.
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
| T2 | Hosted on **GitHub Pages** from a public repo named **`lmnt-ish`**, which serves it at **https://mattbat.com/lmnt-ish/** through the existing `mattbat.github.io` custom domain. The landing page in `mattbat.github.io` gets a link to it. |
| T3 | Every config uses the subpath `/lmnt-ish/`: Vite `base`, manifest `start_url` and `scope`, service-worker scope, and `navigateFallback`. Routing uses hash URLs, because Pages can't fall back to `index.html`. |
| T4 | Works completely offline after the first load. The service worker caches all app files. |
| T5 | All data lives on the device in IndexedDB (Dexie). The app requests persistent storage. |
| T6 | Schema changes use versioned Dexie migrations. An app update never erases data. |
| T7 | Updates are never applied silently. An "Update available" prompt lets the user choose when, and it's held back while mixing mode is open. |
| T8 | Stack: React + TypeScript + Vite, `vite-plugin-pwa` (Workbox), Dexie. Copied from next5: `pwaUpdate.ts`, `UpdateBanner`, `InstallHint`, `useWakeLock`, `share.ts` (`shareFile` / `shareLink`), backup, error banner, Diagnostics. |
| T9 | Targets current iOS Safari and Android Chrome in portrait, at 375–440 pt wide. Desktop browsers work but aren't designed for. |

## 4. Core concepts

- **Ingredient:** something you buy and weigh. It has a name, a package size (grams), a package price, an optional buy link, its **electrolyte content** (the fraction of its weight that is sodium, potassium and magnesium), and an optional **grams per teaspoon** for volume measuring.
- **Recipe:** a name, a color, optional notes, and a list of ingredients, each with **grams per serving**. Ingredients are grouped as **Base** (the electrolytes) or **Flavor** (fruit powder, acid, sweetener), but this is for display only. The math treats every line the same.
- **Serving:** one drink, meant for 16–32 oz of water (from LMNT's guidance).
- **Vial:** a container holding a whole number of servings (default 1). The fill weight is grams per serving × servings per vial.
- **Batch:** one mixing session. It's a recipe × a number of servings, with the weight of each ingredient, the fill weight per vial, the cost, and notes. Once logged, a batch keeps a **snapshot** of the recipe as it was, so editing the recipe later never changes the history.
- **Strength:** not in v1 (see Q3). For a lighter drink you use less powder or more water.

## 5. Default data

### 5.1 Ingredients (from `lmnt.xlsx`)

| Ingredient | Package | Price | $/g | Electrolyte content | g/tsp (approx.) |
|---|---|---|---|---|---|
| Redmond Real Salt (sea salt) | 26 oz (737.1 g) | $11.39 | 0.0155 | Sodium **0.38** (check the label, Q1) | 5.0 |
| Potassium chloride | 250 g | $17.97 | 0.0719 | Potassium 0.524 | 5.75 |
| Magnesium malate | 250 g | $19.97 | 0.0799 | Magnesium 0.154 | — |
| Malic acid | 8 oz (226.8 g) | $8.95 | 0.0395 | — | — |
| Citric acid | 340 g | $6.99 | 0.0206 | — | — |
| Lemon powder | 284 g | $11.98 | 0.0422 | — | — |
| Watermelon juice powder | 250 g | $20.97 | 0.0839 | — | — |
| Stevia | 4 oz (113.4 g) | $15.99 | 0.1410 | — | — |

- Electrolyte fractions: pure sodium chloride is 39.3% sodium and potassium chloride is 52.4% potassium (from atomic weights). Magnesium malate is 15.4% magnesium, from LMNT's 390 mg → 60 mg. Redmond Real Salt contains trace minerals, so it is a little under 39.3%. The default is a placeholder until it's checked against the label.
- The teaspoon weights for salt and potassium chloride come from LMNT's volume measurements (75 g ≈ 15 tsp; 11.5 g ≈ 2 tsp). The others are blank until the user weighs a level teaspoon (see U3).
- Users can add **di-magnesium malate** (22.6% magnesium, 0.265 g per serving for 60 mg) as an alternative, but it isn't a default.

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
- Retail comparison: **$1.50 per stick** (LMNT lists a 30-count box at $45; about $1.28 with Amazon Subscribe & Save). Editable.
- Scale precision: **0.01 g**. Editable: 0.01 / 0.1 / 1 g.
- Servings per vial: **1**.
- Default batch: **30 servings**.
- Units: **grams**.
- Theme: follows the system (light or dark).

## 6. Calculator

| ID | Requirement |
|----|-------------|
| C1 | **Batch size by servings:** enter N servings. Each ingredient = grams per serving × N. |
| C2 | **Batch size by vials:** enter V vials. N = V × servings per vial. |
| C3 | **Batch size by total weight:** enter W grams of mix. N = floor(W ÷ grams per serving), and the app shows the leftover powder. |
| C4 | Every ingredient line shows the batch weight rounded to the scale precision, plus the per-serving weight. Rounding is applied for display only. Totals and cost use the unrounded values. |
| C5 | **Totals:** batch weight, fill weight per vial, cost per batch, cost per serving, and savings compared with retail (per serving and per batch: (retail − cost per serving) × N). |
| C6 | **Electrolytes per serving:** for each mineral, the sum over ingredients of grams per serving × fraction × 1000 (mg). Also shown as a share of the FDA daily value for sodium (2,300 mg) and potassium (4,700 mg). |
| C7 | **Precision warning:** if any batch weight is less than 20× the scale precision (so rounding could be off by more than 5%), mark that line and suggest a bigger batch or a finer scale. Example: on a 0.1 g scale, 10 servings of Watermelon needs 1.2 g of stevia, which is fine. 1 serving needs 0.12 g, which gets a warning. |
| C8 | Changing the batch size or recipe updates everything instantly. Nothing needs saving. The last batch size used for each recipe is remembered. |
| C9 | The calculation is one pure TypeScript module (`src/calc`) with no React, Dexie or DOM imports, so it can be tested on its own (Q-2). |

## 7. Mixing mode

| ID | Requirement |
|----|-------------|
| M1 | Started from the calculator with **Start mixing**. Shows one ingredient at a time in large type: name, target weight, and a reminder to **tare the scale first**. |
| M2 | **Done → next** moves to the next ingredient. A progress strip shows done and remaining ingredients, and any ingredient can be tapped to jump back. |
| M3 | Optional **actual weight** field for each ingredient. If the user enters it, the log records it, and a difference over 5% gets a gentle flag. |
| M4 | Order: Base ingredients first (largest first), then Flavor. Within Flavor, the smallest ingredients go first, so a slip with stevia doesn't waste fruit powder. Users can reorder. |
| M5 | After the last ingredient: a **Mix** step ("Combine and mix thoroughly; break up clumps or sift the fruit powder"), then a **Fill** step: "Fill V vials with X g each" plus any leftover. |
| M6 | The screen stays on during mixing mode (Screen Wake Lock, as in next5). If the phone locks or the app is closed, mixing mode resumes on the same step. |
| M7 | **Finish** saves the batch to the log (§8) and offers a notes field there and then. **Cancel** discards it after confirming. |
| M8 | Tips shown once, and available from Help: weigh on a dry day; fruit powder and malic acid absorb moisture and clump; use sealed vials and a food-safe desiccant pack. |

## 8. Batch log

| ID | Requirement |
|----|-------------|
| L1 | Each entry stores the date, a recipe snapshot (name, color, ingredients and grams per serving), servings, vials, fill weight, each ingredient's target (and actual, if entered) weight, cost, and **notes**. |
| L2 | The log lists entries newest first, filterable by recipe. Each row shows the date, recipe, servings, and the first line of the notes. |
| L3 | Notes can be added or edited at any time afterwards ("A bit sour; try 0.5 g malic acid next time"). |
| L4 | **Make again** opens the calculator with that batch's recipe and size. If the recipe has changed since, the app asks whether to use the recipe as it was then or as it is now. |
| L5 | Entries can be deleted after confirming. Batches can also be logged by hand without mixing mode. |
| L6 | **Optional rating** (1–5) on each entry. See Q5. |

## 9. Screens

1. **Recipes (home):** a card for each recipe showing its color, name, grams per serving, cost per serving, and sodium / potassium / magnesium. Buttons for **+ New recipe** and **Paste recipe link**.
2. **Calculator:** for the chosen recipe. Batch size (servings / vials / weight), ingredient lines, totals, electrolytes, savings, **Start mixing**, **Share recipe**, **Edit recipe**.
3. **Mixing mode** (§7).
4. **Recipe editor:** name, color, notes, ingredient lines (pick from Ingredients or add a new one), grams per serving, reorder, duplicate, delete. Live totals update as you edit.
5. **Ingredients:** the price list. Package size and unit, price, buy link, electrolyte fractions, and grams per teaspoon with a **Measure** helper (weigh 1 level tsp). Shows the price per gram.
6. **Log** (§8) and **Log entry**.
7. **Receive recipe:** the screen a share link opens (§11).
8. **Settings:** units, scale precision, servings per vial, retail comparison price, theme, backup and restore, version, and check for updates.
9. **About:** what LMNT-ish is, a credit and link to LMNT's recipe article, the not-affiliated statement, the full disclaimer (§10), a **Buy the real thing** link to drinklmnt.com, and **Equipment** (a placeholder in v1).
10. **Help:** short topics on making a batch, mixing mode, sharing, backups, measuring by teaspoon, and storage tips.

Navigation: a bottom tab bar with **Recipes · Log · Ingredients · More** (Settings, About, Help).

## 10. Disclaimer and credit

| ID | Requirement |
|----|-------------|
| D1 | **First launch:** a one-screen notice that must be acknowledged once: "LMNT-ish is a personal project, not medical advice. Each serving has about 1,000 mg of sodium. Check with a doctor first if you have kidney disease, high blood pressure, or heart failure, are pregnant, or take medication that affects potassium (for example ACE inhibitors, ARBs, or potassium-sparing diuretics)." |
| D2 | **Every calculator screen** shows a short footer: *"Not medical advice · Not affiliated with LMNT."* It links to About. |
| D3 | **About** has the full text: not medical advice; not made by or affiliated with LMNT; LMNT is a trademark of its owner; the base ratios come from the recipe LMNT published (linked); store powders away from children, since concentrated potassium chloride is harmful in large amounts; the user is responsible for their ingredients and measurements. |
| D4 | **Branding:** LMNT-ish has its own icon, colors and type, and doesn't copy LMNT's logo, fonts or packaging. |
| D5 | A shared recipe opens with the D2 footer and a link to the D1 notice for people who haven't seen it. |

## 11. Sharing

| ID | Requirement |
|----|-------------|
| SH1 | **Share recipe** creates a link like `https://mattbat.com/lmnt-ish/#r=<data>`. The recipe (name, color, notes, ingredient lines with grams per serving, and each ingredient's name, electrolyte fractions and grams per tsp) is turned into compact JSON, compressed, and base64url-encoded after the `#`, so it never reaches the server. Prices are left out. |
| SH2 | The link is sent with the share sheet (Messages, WhatsApp, email), or copied to the clipboard where sharing isn't available. Target length: under 1,500 characters for a typical recipe. |
| SH3 | **Receive:** opening the link shows a preview (ingredients, grams per serving, electrolytes) and **Add to my recipes**. Each ingredient is matched to an existing one by name (ignoring case). Unmatched ingredients are created without a price. If a recipe with the same name exists, the user chooses **Replace** or **Keep both** ("Lemon (2)"). |
| SH4 | Someone without the app can use a shared recipe right away in the browser. As in next5, **Copy for the LMNT-ish app** lets an iPhone user move it into the installed app, which keeps its own storage. |
| SH5 | Each link includes a format version so future versions can still read old links. Invalid or damaged links show a friendly error, never a crash. |

## 12. Units

| ID | Requirement |
|----|-------------|
| U1 | The weight display switches between **grams** and **ounces** (1 oz = 28.3495 g). Amounts are always stored in grams. |
| U2 | **Teaspoon view:** where an ingredient has a grams-per-tsp value, show an approximate volume rounded to a kitchen-friendly fraction (⅛ tsp at the smallest). Clearly labeled *approximate: powders vary in density, so weigh when you can* (from LMNT's own advice). Ingredients without a value show "weigh only". |
| U3 | **Measure helper:** "Level off 1 tsp, put it on the scale, enter the weight" sets an ingredient's grams per tsp. |
| U4 | Package sizes can be entered in g, kg, oz or lb and are converted to grams. |
| U5 | The suggested water per serving is shown as **16–32 oz (about 0.5–1 L)**. |

## 13. Backup

| ID | Requirement |
|----|-------------|
| B1 | **Back up** exports everything (ingredients, recipes, batch log, settings) to one JSON file through the share sheet, or downloads it where sharing isn't available. Uses next5's `shareFile`. |
| B2 | **Restore** from a backup file: **Replace all** or **Merge** (match by ID; the newer `updatedAt` wins). Restore always shows a summary and asks to confirm. |
| B3 | Reminder when the log has entries and there's been no backup in 60 days. |
| B4 | Backups have a format version and are migrated when restored into a newer app. |

> Data is lost if the app is removed from the home screen or the browser's site data is cleared. This is why B1–B3 matter.

## 14. Design and UX

- **Look:** bright, clean and kitchen-friendly, in light and dark themes. Each recipe has a color (Raw: slate, Lemon: yellow, Watermelon: pink-red) used on its card, calculator header and mixing-mode screens. Numbers are big and easy to read from arm's length. The look is LMNT-ish's own (D4).
- Mixing mode is designed for one hand, possibly with powder on your fingers: tap targets of at least 56 pt, the main button within thumb reach, and no swipe gestures needed.
- Grams use tabular figures so columns line up.
- Respects safe areas and uses `viewport-fit=cover`. No accidental zoom or pull-to-refresh in mixing mode.
- Destructive actions (delete recipe, delete log entry, Replace all) ask for confirmation.
- Accessibility: Dynamic Type, screen-reader labels, and contrast at least WCAG AA in both themes.
- A designed home-screen icon and splash screen. Mockups of the Calculator and Mixing mode are reviewed before the full build.

## 15. Non-functional requirements

| ID | Requirement |
|----|-------------|
| N1 | Opens to a usable screen in under 2 seconds, offline. |
| N2 | Every change is saved immediately. There's no Save button except in the recipe editor. |
| N3 | No analytics, tracking, or network calls other than app updates. |
| N4 | The whole app (JS + CSS) is under 250 KB gzipped, not counting icons. |

### Testing and CI (same approach as next5)

| ID | Requirement |
|----|-------------|
| Q-1 | Every change passes `npm run check` (lint, type-check, unit tests with coverage, build, e2e) before it's committed. |
| Q-2 | **Calculator (`src/calc`):** example tests that reproduce the spreadsheet's numbers for all three recipes (grams, cost and $/g), plus property tests (fast-check) showing that scaling is linear, totals equal the sum of the lines, display rounding never changes cost, the vial / serving / weight modes agree, and electrolyte math matches the fractions. |
| Q-3 | Unit and component tests for the share-link round trip (encode → decode → same recipe), invalid links, backup and restore (replace and merge), migrations, and unit conversion. |
| Q-4 | Playwright e2e at iPhone size (WebKit) and Android size (Chromium): open a recipe → set 30 servings → mix → log with notes → Make again; share a link → open it in a new context → add the recipe; back up → clear → restore; launch offline. |
| Q-5 | Coverage: 95% lines for `src/calc` and 80% overall. The build fails below these. |
| Q-6 | GitHub Actions on every push and PR. Deploying to Pages happens only from `main`, after every job passes (copy next5's `ci.yml`). |

## 16. Documentation

| ID | Requirement |
|----|-------------|
| H-1 | **README for users:** what the app is, the credit and disclaimer, how to install it on iPhone and Android, a quick start (make a batch), sharing, and backups. |
| H-2 | **README for developers:** stack, layout, local setup, tests, deployment, the share-link format, and the calculation formulas. |
| H-3 | Empty states that explain what to do next (an empty log, a recipe with no ingredients). |
| H-4 | An ⓘ next to electrolyte fractions, scale precision, grams per tsp, and the comparison price. |
| H-5 | `CLAUDE.md` and `docs/STATUS.md`, as in next5. |

## 17. Decisions log

| Date | Decision |
|------|----------|
| 2026-11-07 | The name is **LMNT-ish**, at mattbat.com/lmnt-ish/. It's non-commercial and credits LMNT, with a not-affiliated statement (§10). |
| 2026-11-07 | The stack, hosting and CI copy next5 (React + TS + Vite + vite-plugin-pwa + Dexie, GitHub Pages, GitHub Actions). |
| 2026-11-07 | Recipes are stored as grams per serving, and every ingredient scales together. |
| 2026-11-07 | v1 includes the batch log with notes, share links, unit conversion, the disclaimer, offline support and backup. |
| 2026-11-07 | No inventory tracking and no labels. |
| 2026-11-07 | Default recipes are Raw, Lemon and Watermelon only. |
| 2026-11-07 | The default retail comparison is $1.50 per stick, editable. |
| 2026-11-07 | The equipment page is a placeholder until Matt sends the list. |

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
- **Teaspoon amounts are inaccurate**, because powder density varies by brand and humidity. They're labeled as approximate, and the app pushes weighing (U2).
- **Electrolyte numbers depend on user-entered fractions.** The defaults are documented (§5.1), and sodium for Redmond salt needs checking against the label (Q1).
- **Share links in some messaging apps** can be cut off or have the `#` part stripped. Keep links short (SH2), and offer sharing a file as a fallback if this turns out to be a problem.
- **iOS storage eviction:** rare for installed PWAs. Backup (§13) is the safeguard.
