# Implementation status

Tracks every requirement in [REQUIREMENTS.md](../REQUIREMENTS.md). Update this file in the same change that implements something.

**Legend:** ✅ Done · 🟡 Partial · ⬜ Not started · ➖ Dropped · 📱 Needs checking on a real phone

Last updated: 2026-11-07 (after the first phone test: read-only app with built-in recipes, per [docs/PLAN-phone-feedback.md](PLAN-phone-feedback.md); 154 unit tests, 19 e2e runs, `npm run check` green)

## Platform

| ID | Status | Notes |
|----|--------|-------|
| T1 | 🟡 📱 | Manifest, icons and standalone display are in place. Install on a real iPhone and Android phone still to be checked. |
| T2 | 🟡 | Build is ready for `/lmnt-calculator/`. Needs the GitHub repo `lmnt-calculator`, Pages enabled, and the link added in `mattbat.github.io`. |
| T3 | ✅ | Vite `base`, manifest `start_url`/`scope`, `navigateFallback` and Playwright `baseURL` all use `/lmnt-calculator/`; hash routes. |
| T4 | ✅ | Service worker precaches the app; e2e launches offline (Chromium). |
| T5 | ✅ | Dexie storage for the batch log and settings; `navigator.storage.persist()` is requested on launch. Recipes and ingredients are built into the code (`src/calc/defaults.ts`). |
| T6 | ✅ | Versioned Dexie schema (`src/data/db.ts`): `version(2)` drops the recipes and ingredients tables, with a migration test from a real v1 database. |
| T7 | ✅ | Update banner is manual ("Update" / "Later") and hidden on `#/mix/...`. |
| T8 | ✅ | `pwaUpdate`, `UpdateBanner`, `InstallHint`, `useWakeLock`, `share.ts`, backup, error banner and Diagnostics (in Settings) are all used. |
| T9 | 🟡 📱 | Designed and e2e-tested at 402 and 412 pt wide; real devices not yet tried. |

## Calculator (§6)

| ID | Status | Notes |
|----|--------|-------|
| C1–C3 | ✅ | Servings / Vials / Weight segmented control (leftover shown for weight). Component tests for each. |
| C4 | ✅ | Batch weight rounded to precision for display, plus per-serving weight; cost uses unrounded values. |
| C5 | ✅ | Compact Summary card: batch weight, vials × fill and batch cost in a row; cost per serving and savings (per serving and per batch) vs retail; the last, partial vial noted. |
| C6 | ✅ | mg per serving as chips in the Summary card, with % daily value for sodium and potassium. |
| C7 | ✅ | "Low precision" chip on the calculator and in mixing mode. |
| C8 | ✅ | Live recalculation; last batch size remembered per recipe (`lastBatchSize`). |
| C9 | ✅ | All maths in `src/calc` (small helpers `vialPlan` and `pricePerGram` live there too). |

## Mixing mode (§7)

| ID | Status | Notes |
|----|--------|-------|
| M1 | ✅ | One ingredient at a time in large type, with a tare reminder. **Start mixing** sits directly under the batch size (e2e checks it is on screen without scrolling). |
| M2 | ✅ | Done → next; progress strip of 56 px chips, tap to jump back; Back button. |
| M3 | ➖ | Dropped 2026-11-07 (actual weight and the 5% flag removed). Old entries that have actual weights still show them. |
| M4 | ✅ | Base largest first, then flavor smallest first. "Weigh later" lets you postpone the current ingredient (swap with the next). |
| M5 | ✅ | Mix step ("Combine and mix thoroughly. Break up any clumps."), then Fill step ("Fill V vials with X g each", partial last vial, leftover). |
| M6 | 📱 | Wake lock via `useWakeLock` (hint shown if not held); progress saved in localStorage (`lmnt-calculator.mix.<recipeId>`, with a session id) and resumed after reload (tested). Wake lock on a real iPhone Home Screen app needs a phone check. |
| M7 | ✅ | Finish logs the batch then shows a notes field; Cancel asks to confirm. |
| M8 | ✅ | Tips card shown once; also in Help. |

## Batch log (§8)

| ID | Status | Notes |
|----|--------|-------|
| L1 | ✅ | Snapshot, servings, vials, fill, targets, cost and notes. Old entries may carry actual weights, which still display. |
| L2 | ✅ | Newest first, filter by recipe, first line of notes. |
| L3 | ✅ | Notes editable any time (button and on blur). |
| L4 | ✅ | Simplified: Make again opens the calculator at that size. If the recipe no longer exists in the app, the entry still shows its snapshot and Make again is hidden. |
| L5 | ✅ | Delete with confirmation; "Log a batch by hand". |
| L6 | ✅ | Optional 1–5 stars. |

## Screens (§9)

Recipes (cards with name, cost per serving and electrolytes only), Calculator (Start mixing and Share under the batch size, Weigh out, Summary card), Mixing mode, Ingredients (read-only: name, package size, price, price per gram, buy link if any), Log, Log entry, Settings, About (with Equipment placeholder) and Help are all built. Bottom tabs: Recipes · Log · Ingredients · More. ✅ Dropped 2026-11-07: Recipe editor, Receive recipe, ingredient editing (➖).

## Disclaimer and credit (§10)

| ID | Status | Notes |
|----|--------|-------|
| D1 | ✅ | First-launch notice gates the app until acknowledged (`settings.disclaimerAcceptedAt`). |
| D2 | ✅ | Footer on Recipes, Calculator, Mixing and Log entry; links to About. |
| D3 | ✅ | Full text under More → About, with credit link to LMNT's article. |
| D4 | ✅ | Own icon, colors and type. Final icon chosen 2026-11-07: a white drop with an indigo lightning bolt on an indigo tile (`#4f46e5`); options explored are in `docs/icon-research/`. |
| D5 | ✅ | A shared link opens the recipe's calculator, which has the footer; the notice gate runs first for anyone who hasn't seen it (e2e covers this). |

## Sharing (§11)

| ID | Status | Notes |
|----|--------|-------|
| SH1–SH5 | ➖ | Dropped 2026-11-07: recipe data links, Receive screen, Add to my recipes, Copy for the app, and versioned links are gone. Old `#r=` links just open Recipes. |
| SH (new) | ✅ 📱 | **Share recipe** sends `.../lmnt-calculator/#/recipe/<id>` through the share sheet (clipboard where unavailable). e2e: the shared URL ends `#/recipe/watermelon` and opens the disclaimer then the Watermelon calculator in a fresh context. Real-phone share sheet still to be checked. |

## Units (§12)

| ID | Status | Notes |
|----|--------|-------|
| U1 | ✅ | g / oz toggle on the calculator and in Settings. |
| U2 | ➖ | Dropped 2026-11-07 (teaspoon view). |
| U3 | ➖ | Dropped 2026-11-07 (Measure helper). |
| U4 | ✅ | Simplified: package sizes are built in (grams) and shown in the chosen unit on Ingredients. Entering sizes in other units went with the editor. |
| U5 | ✅ | "16–32 oz (about 0.5–1 L)" shown on the calculator. |

## Backup (§13)

| ID | Status | Notes |
|----|--------|-------|
| B1 | ✅ | Back up now (share sheet, or download). Format 2 holds batches and settings only. |
| B2 | ✅ | Restore shows a summary; Merge, or Replace all with a second confirmation. Format 1 files still restore (recipes and ingredients in them are ignored). |
| B3 | ✅ | Reminder banner on Recipes with **Back up now** and **Not now** (snoozes 30 days; unit and e2e tests). |
| B4 | ✅ | Format version and migration hook (1 to 2 migration tested). |

## Non-functional (§15)

| ID | Status | Notes |
|----|--------|-------|
| N1 | 📱 | Small bundle and offline precache; timing not measured on a phone. |
| N2 | ✅ | Every change saves immediately; there are no Save buttons. |
| N3 | ✅ | No analytics; no network calls other than update checks. |
| N4 | ✅ | About 118 KB JS + 3 KB CSS gzipped (limit 250 KB). |

## Testing and CI (§15)

| ID | Status | Notes |
|----|--------|-------|
| Q-1 | ✅ | `npm run check` passes: lint, types, 154 unit/component tests, build, 19 Playwright runs. |
| Q-2 | ✅ | Calc example and property tests. |
| Q-3 | ✅ | Share URL, backup/restore (format 1 and 2), Dexie v1 to v2 migration, unit conversion, plus screen tests. |
| Q-4 | ✅ | e2e on iPhone WebKit and Android Chromium: batch to log to Make again (Start mixing on screen at load); share link to a fresh context; backup, clear, restore; Ingredients read-only; old `#r=` link; backup banner Not now; offline launch. |
| Q-5 | ✅ | Coverage about 98% lines overall, 100% for `src/calc`; thresholds enforced. |
| Q-6 | 🟡 | CI workflow written (deploy only from `main`), not yet run on GitHub. |

## Design (§14) and documentation (§16)

| Item | Status | Notes |
|------|--------|-------|
| Look and themes | ✅ | Light and dark via CSS variables; recipe color on cards, headers and mixing screens (text color picked for contrast). 📱 Check contrast and Dynamic Type on a phone. |
| Tap targets | ✅ | 44 px or more everywhere; 56 px or more in mixing mode. |
| Safe areas, no zoom | ✅ | `viewport-fit=cover`, safe-area padding. |
| Splash screen, final icon | 🟡 | Final icon done (indigo drop and bolt). No designed splash screen yet; the app tint is still teal. |
| H-1 | ✅ | User README (read-only built-in recipes, sharing a link, Not now). |
| H-2 | ✅ | Developer README (stack, layout, setup, CI/CD, share link, backup format 2, formulas). |
| H-3 | ✅ | Empty states for the log and the built-in lists. |
| H-4 | ✅ | ⓘ on scale precision and the comparison price (the electrolyte, grams per tsp and grams per serving ones went with the editors). |
| H-5 | ✅ | `CLAUDE.md` and this file. |
| Equipment page | 🟡 | Placeholder in About ("Coming soon: the scale, vials and tools I use"); waiting for Matt's list. |
