# LMNT Calculator: notes for Claude

Phone PWA for mixing a homemade electrolyte drink powder, served at https://mattbat.com/lmnt-calculator/. The spec is `REQUIREMENTS.md`; the build plan and module contracts are in `docs/BUILD_PLAN.md`; progress is tracked in `docs/STATUS.md`.

## Rules for every change

- Run `npm run check` (lint, type-check, unit tests with coverage, build, e2e) and make sure it passes before committing. Never commit failing work (Q-1).
- Update `docs/STATUS.md` in the same change that implements or alters a requirement.
- Add tests with every feature. `src/calc` needs example tests and property tests (fast-check), at 95% line coverage.
- Keep `src/calc` pure: no React, Dexie or DOM imports.
- Shared types live in `src/types.ts`. Change them only on purpose, and update every user.
- Screens write data only through `src/data/repo.ts`.
- Never edit an existing Dexie `version(n)`. Add a new version with a migration and a test.
- Amounts are always stored in grams. Unit conversion happens only for display.
- Everything uses the `/lmnt-calculator/` base path (Vite `base`, manifest, service worker, Playwright `baseURL`).
- Don't copy LMNT's logo, fonts or packaging look (D4). Keep the "Not medical advice · Not affiliated with LMNT" footer on calculator screens (D2).
- On Windows, edit files with the Edit/Write tools, not PowerShell `Set-Content` (it mangles UTF-8 characters like · — ½).
- The reference implementation for tooling and shared pieces is the sibling repo `C:\Users\matth\repos\next5` (read-only; never edit it).
