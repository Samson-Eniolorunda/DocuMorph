# DocuMorph

Private PDF and image tools that run in your browser.

Proprietary software. Copyright (c) 2026 Samson Eniolorunda. All rights reserved (see `LICENSE`).

## Tools

Run on the visitor's device (no upload):

- **Edit PDF**: add text, cover and retype, highlight, boxes, images, signatures (drawn, typed or uploaded), fill and lock forms, delete pages.
- **Compress PDF** (a light tidy that keeps the text, or smaller pages at a chosen quality), **Merge PDF**, **Split PDF** (page ranges, every N pages, every page), **Organise pages** (reorder, rotate, delete with previews).
- **Images to PDF**, **PDF to images** (PNG or JPG at 72, 150 or 300 dpi).
- **Convert, resize and compress images** (JPG, PNG, WebP; compress by quality or to a target size).

Processed on a server, files up to 4 MB, nothing stored:

- Word to PDF and Excel to PDF: Gotenberg (LibreOffice), self-hosted on Google Cloud Run (`infra/gotenberg/README.md`).
- PDF to Word and PDF to Excel: Adobe PDF Services, free tier, with a monthly and a daily cap for the whole site.

## How it is built

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.
- [pdf-lib](https://pdf-lib.js.org) writes PDFs; [pdf.js](https://mozilla.github.io/pdf.js/) renders them. Both run in the browser and are fetched only when a file is chosen; the pdf.js worker is bundled with the site, so nothing loads from a third-party CDN.
- Files are identified by their first bytes, not their names, in the browser and on the server.
- Edits are stored in page coordinates as displayed and converted to PDF coordinates on save, including pages stored rotated (`src/lib/coords.ts`).
- Text uses the standard PDF fonts; characters outside their range (for example Yoruba tone marks) switch to a bundled Noto Sans, embedded as a subset.
- The server route (`src/app/api/convert/route.ts`) accepts only the listed conversions, checks the file signature and size, limits each visitor per day by a hashed IP address, and counts a conversion only when it succeeds. The converted file is returned in the same response; nothing is written anywhere. Adobe calls are capped per month and per day for the whole site.
- Feedback (`src/app/api/feedback/route.ts`) is validated, limited per visitor and e-mailed to the owner through Resend; nothing is stored.
- Security headers are set for every page (`next.config.ts`).

## Run locally

```bash
npm install
npm run dev
```

Checks: `npm run typecheck`, `npm run lint` (zero warnings), `npm run format:check`, `npm test` (Vitest), `npm run build`, and `npm run e2e` (Playwright, phone and desktop projects; set `PW_CHROMIUM_PATH` to use an installed Chromium). `node scripts/screens.mjs` and `node scripts/screens-states.mjs` take review screenshots.

## Settings

| Name                                                        | Required                         | Purpose                                                                                      |
| ----------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                      | Yes (the build stops without it) | Public address, for canonical addresses, the sitemap and share images.                       |
| `NEXT_PUBLIC_PORTFOLIO_URL`                                 | No                               | The owner's name in the footer links here. Unset: plain text.                                |
| `NEXT_PUBLIC_BUYMEACOFFEE_URL`                              | No                               | The "Buy me a coffee" links. Unset: hidden.                                                  |
| `GOTENBERG_URL`, `GOTENBERG_USERNAME`, `GOTENBERG_PASSWORD` | For Word and Excel to PDF        | The Cloud Run service and its basic-authentication login.                                    |
| `PDF_SERVICES_CLIENT_ID`, `PDF_SERVICES_CLIENT_SECRET`      | For PDF to Word and PDF to Excel | Adobe PDF Services credentials.                                                              |
| `ADOBE_MONTHLY_CAP`, `ADOBE_DAILY_CAP`                      | No                               | Whole-site caps (defaults 450 and 25).                                                       |
| `RESEND_API_KEY`, `FEEDBACK_TO_EMAIL`                       | For feedback                     | Resend key and the owner's address.                                                          |
| `CONVERT_DAILY_PER_VISITOR`                                 | No                               | Server conversions per visitor per day (default 10).                                         |
| `CONVERT_DAILY_SITE_CAP`, `CONVERT_DAILY_ATTEMPT_CAP`       | No                               | Whole-site conversions and attempts per day (defaults 200 and 300; always on, 0 is refused). |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`        | For every server tool            | Shared counts. Without them the server tools stay off, because the caps must be exact.       |

See `.env.example`.
