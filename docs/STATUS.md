# Implementation status

Tracks every requirement in [REQUIREMENTS.md](../REQUIREMENTS.md). Update this file in the same change that implements something.

**Legend:** ✅ Done · 🟡 Partial · ⬜ Not started · ➖ Dropped · 📱 Needs checking on a real phone

Last updated: 2026-11-07 (phase 1 scaffold done: app shell, tooling, CI; no calculator or data layer yet)

| Area | IDs | Status |
|------|-----|--------|
| Platform | T1–T9 | 🟡 Shell only: PWA manifest, offline service worker (T4, e2e-tested), `/lmnt-calculator/` paths (T3), update banner held back in mixing mode (T7), shared modules copied (T8: `pwaUpdate`, `UpdateBanner`, `InstallHint`, `useWakeLock`, `share.ts`, error banner). Not yet: Dexie storage and persistent storage request (T5, T6), install/phone check 📱 (T1, T9). T2 needs the GitHub repo and Pages set up. |
| Calculator | C1–C9 | ⬜ |
| Mixing mode | M1–M8 | ⬜ |
| Batch log | L1–L6 | ⬜ |
| Disclaimer and credit | D1–D5 | ⬜ |
| Sharing | SH1–SH5 | ⬜ |
| Units | U1–U5 | ⬜ |
| Backup | B1–B4 | ⬜ |
| Non-functional | N1–N4 | ⬜ |
| Testing and CI | Q-1–Q-6 | 🟡 Harness done: `npm run check` (lint, types, unit tests with 80% / 95% `src/calc` coverage gates, build, Playwright on WebKit iPhone, Chromium Android and offline Chromium) (Q-1); CI workflow with deploy only from `main` (Q-6, not yet run on GitHub). Feature tests (calc property tests, screen e2e) arrive with later phases. |
| Documentation | H-1–H-5 | ⬜ |
| Equipment page | — | ⬜ Waiting for Matt's list |
