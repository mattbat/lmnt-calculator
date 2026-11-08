# Implementation status

Tracks every requirement in [REQUIREMENTS.md](../REQUIREMENTS.md). Update this file in the same change that implements something.

**Legend:** ✅ Done · 🟡 Partial · ⬜ Not started · ➖ Dropped · 📱 Needs checking on a real phone

Last updated: 2026-11-07 (phase 3: all screens, e2e tests and README done; 201 unit tests, 15 e2e runs, `npm run check` green)

## Platform

| ID | Status | Notes |
|----|--------|-------|
| T1 | 🟡 📱 | Manifest, icons and standalone display are in place. Install on a real iPhone and Android phone still to be checked. |
| T2 | 🟡 | Build is ready for `/lmnt-calculator/`. Needs the GitHub repo `lmnt-calculator`, Pages enabled, and the link added in `mattbat.github.io`. |
| T3 | ✅ | Vite `base`, manifest `start_url`/`scope`, `navigateFallback` and Playwright `baseURL` all use `/lmnt-calculator/`; hash routes. |
| T4 | ✅ | Service worker precaches the app; e2e launches offline (Chromium). |
| T5 | ✅ | Dexie storage; `navigator.storage.persist()` is requested on launch. |
| T6 | ✅ | Versioned Dexie schema (`src/data/db.ts`) with a test. |
| T7 | ✅ | Update banner is manual ("Update" / "Later") and hidden on `#/mix/...`. |
| T8 | ✅ | `pwaUpdate`, `UpdateBanner`, `InstallHint`, `useWakeLock`, `share.ts`, backup, error banner and Diagnostics (in Settings) are all used. |
| T9 | 🟡 📱 | Designed and e2e-tested at 402 and 412 pt wide; real devices not yet tried. |

## Calculator (§6)

| ID | Status | Notes |
|----|--------|-------|
| C1–C3 | ✅ | Servings / Vials / Weight segmented control (leftover shown for weight). Component tests for each. |
| C4 | ✅ | Batch weight rounded to precision for display, plus per-serving weight; cost uses unrounded values. |
| C5 | ✅ | Batch weight, fill per vial, cost per batch and serving, savings per serving and batch. Vials shown rounded up with the last, partial vial noted. |
| C6 | ✅ | mg per serving and % daily value for sodium and potassium. |
| C7 | ✅ | "Low precision" chip on the calculator and in mixing mode. |
| C8 | ✅ | Live recalculation; last batch size remembered per recipe (`lastBatchSize`). |
| C9 | ✅ | All maths in `src/calc` (new small helpers `vialPlan`, `pricePerGram`, `weightDeviation` added there). |

## Mixing mode (§7)

| ID | Status | Notes |
|----|--------|-------|
| M1 | ✅ | One ingredient at a time in large type, with a tare reminder. |
| M2 | ✅ | Done → next; progress strip of 56 px chips, tap to jump back; Back button. |
| M3 | ✅ | Optional actual weight (in the chosen unit), flagged when more than 5% off; recorded in the log. |
| M4 | ✅ | Base largest first, then flavor smallest first. "Weigh later" lets you postpone the current ingredient (swap with the next). |
| M5 | ✅ | Mix step, then Fill step ("Fill V vials with X g each", partial last vial, leftover). |
| M6 | 📱 | Wake lock via `useWakeLock` (hint shown if not held); progress saved in localStorage (`lmnt-calculator.mix.<recipeId>`, with a session id) and resumed after reload (tested). Wake lock on a real iPhone Home Screen app needs a phone check. |
| M7 | ✅ | Finish logs the batch then shows a notes field; Cancel asks to confirm. |
| M8 | ✅ | Tips card shown once; also in Help. |

## Batch log (§8)

| ID | Status | Notes |
|----|--------|-------|
| L1 | ✅ | Snapshot, servings, vials, fill, targets and actuals, cost, notes (tested that recipe edits don't change history). |
| L2 | ✅ | Newest first, filter by recipe, first line of notes. |
| L3 | ✅ | Notes editable any time (button and on blur). |
| L4 | ✅ | Make again opens the calculator at that size. If the recipe changed (or was deleted) you choose the current version or "as it was then" (added as a copy, e.g. "Lemon (2)"). |
| L5 | ✅ | Delete with confirmation; "Log a batch by hand". |
| L6 | ✅ | Optional 1–5 stars. |

## Screens (§9)

Recipes, Calculator, Mixing mode, Recipe editor (add/remove/reorder lines, pick or create ingredients, live totals, duplicate, delete), Ingredients (package size in g/kg/oz/lb, price, buy link, electrolyte %, grams per tsp with Measure helper, price per gram, "Price not set" flag), Log, Log entry, Receive recipe, Settings, About (with Equipment placeholder) and Help are all built. Bottom tabs: Recipes · Log · Ingredients · More. ✅

## Disclaimer and credit (§10)

| ID | Status | Notes |
|----|--------|-------|
| D1 | ✅ | First-launch notice gates the app until acknowledged (`settings.disclaimerAcceptedAt`). |
| D2 | ✅ | Footer on Recipes, Calculator, Mixing, Editor, Receive and Log entry; links to About. |
| D3 | ✅ | Full text under More → About, with credit link to LMNT's article. |
| D4 | ✅ | Own icon, colors and type. The icon is still the placeholder from phase 1. |
| D5 | ✅ | Receive screen shows the footer and a link to the safety notice (and the notice gate runs first for anyone who hasn't seen it). |

## Sharing (§11)

| ID | Status | Notes |
|----|--------|-------|
| SH1, SH2 | ✅ | Share recipe sheet shows the link, with **Share link** (share sheet) and **Copy link** (clipboard). Typical link well under 1,500 characters. |
| SH3 | ✅ | Receive screen: preview, Add to my recipes / Replace / Keep both; unmatched ingredients created without a price and flagged. |
| SH4 | 📱 | **Copy for the LMNT Calculator app** plus **Paste recipe link** on Recipes. The browser to installed-app hand-off needs a phone check. |
| SH5 | ✅ | Versioned links; damaged links give a friendly error. |

## Units (§12)

| ID | Status | Notes |
|----|--------|-------|
| U1 | ✅ | g / oz toggle on the calculator and in Settings. |
| U2 | ✅ | Teaspoon view labelled approximate; "weigh only" where unknown. |
| U3 | ✅ | Measure helper in the ingredient editor. |
| U4 | ✅ | Package size in g, kg, oz or lb. |
| U5 | ✅ | "16–32 oz (about 0.5–1 L)" shown on the calculator. |

## Backup (§13)

| ID | Status | Notes |
|----|--------|-------|
| B1 | ✅ | Back up now (share sheet, or download). |
| B2 | ✅ | Restore shows a summary; Merge, or Replace all with a second confirmation. |
| B3 | ✅ | Reminder banner on Recipes, Log and Settings. |
| B4 | ✅ | Format version and migration hook. |

## Non-functional (§15)

| ID | Status | Notes |
|----|--------|-------|
| N1 | 📱 | Small bundle and offline precache; timing not measured on a phone. |
| N2 | ✅ | Every change saves immediately; the recipe editor has the only Save button. |
| N3 | ✅ | No analytics; no network calls other than update checks. |
| N4 | ✅ | About 126 KB JS + 3 KB CSS gzipped (limit 250 KB). |

## Testing and CI (§15)

| ID | Status | Notes |
|----|--------|-------|
| Q-1 | ✅ | `npm run check` passes: lint, types, 201 unit/component tests, build, 15 Playwright runs. |
| Q-2 | ✅ | Calc example and property tests. |
| Q-3 | ✅ | Link round trip, backup/restore, migrations, unit conversion, plus screen tests. |
| Q-4 | ✅ | e2e on iPhone WebKit and Android Chromium: batch to log to Make again; share link to a fresh context; backup, clear, restore; price edit updates cost; offline launch. |
| Q-5 | ✅ | Coverage about 97% lines overall, 99% for `src/calc`; thresholds enforced. |
| Q-6 | 🟡 | CI workflow written (deploy only from `main`), not yet run on GitHub. |

## Design (§14) and documentation (§16)

| Item | Status | Notes |
|------|--------|-------|
| Look and themes | ✅ | Light and dark via CSS variables; recipe color on cards, headers and mixing screens (text color picked for contrast). 📱 Check contrast and Dynamic Type on a phone. |
| Tap targets | ✅ | 44 px or more everywhere; 56 px or more in mixing mode. |
| Safe areas, no zoom | ✅ | `viewport-fit=cover`, safe-area padding. |
| Splash screen, final icon | 🟡 | Placeholder icon only. |
| H-1 | ✅ | User README. |
| H-2 | ✅ | Developer README (stack, layout, setup, CI/CD, share-link format, formulas). |
| H-3 | ✅ | Empty states for recipes, log, ingredients, and recipes with no lines. |
| H-4 | ✅ | ⓘ on electrolyte fractions, scale precision, grams per tsp, comparison price and grams per serving. |
| H-5 | ✅ | `CLAUDE.md` and this file. |
| Equipment page | 🟡 | Placeholder in About ("Coming soon: the scale, vials and tools I use"); waiting for Matt's list. |
