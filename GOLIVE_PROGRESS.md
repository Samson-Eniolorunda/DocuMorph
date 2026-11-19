# Go-live progress

DONE

All items from the review of 25a9e3f are fixed, each with tests.

- H1: once Gotenberg has been contacted (or Adobe has accepted a job) the attempt stays counted for the visitor and the site; only an unreachable service gives the count back, and a visitor gets at most 3 refunds a day. New never-refunded attempts counter, `CONVERT_DAILY_ATTEMPT_CAP` (default 300). `CONVERT_DAILY_SITE_CAP` now has a minimum of 1 (0 is refused); documented.
- H2: merge, organise, split, form reading and editing refuse protected PDFs with the same message as light compression; tested.
- M1: `/public/pdf.worker.min.mjs` is not in git, is in `.gitignore` and in the ESLint ignores.
- M2: budget command reads the billing account's currency first; mentioned in OWNER_SETUP.md.
- L1: `.env.example`, rate-limit header and docs say every server tool needs Upstash and the site cap is always on.
- L2: tabular figures instead of monospace, Geist Mono dropped, file names wrap on phones.
- L3: upload buttons side by side (grid-cols-2), 44 px tall.
- L4: an export request that times out keeps the Adobe unit; tested.
- L5: `vercel.json` sets region fra1; OWNER_SETUP.md explains Gotenberg in europe-west1 and a matching European Upstash region.

Gates: format:check, lint (0 warnings), typecheck, 114 unit tests, build (via Playwright's server), full Playwright suite (205 passed, including the responsive matrix).

DESIGN_PROGRESS.md stays IN PROGRESS: only the Lighthouse re-run on a deployed site remains.
