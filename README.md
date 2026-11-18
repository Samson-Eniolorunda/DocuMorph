# DocuMorph

Private PDF and image tools that run in your browser.

Live: https://documorph-blue.vercel.app

## Tools

Run on the visitor's device (no upload):

- **Edit PDF**: add text, cover and retype, highlight, boxes, images, signatures (drawn, typed or uploaded), fill and lock forms, delete pages.
- **Merge PDF**, **Split PDF** (page ranges, every N pages, every page), **Organise pages** (reorder, rotate, delete with previews).
- **Images to PDF**, **PDF to images** (PNG or JPG at 72, 150 or 300 dpi).
- **Convert, resize and compress images** (JPG, PNG, WebP; compress by quality or to a target size).

Processed on a server (ConvertAPI), files up to 4 MB:

- Word to PDF, PDF to Word, Excel to PDF, PDF to Excel, Compress PDF.

## How it is built

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.
- [pdf-lib](https://pdf-lib.js.org) writes PDFs; [pdf.js](https://mozilla.github.io/pdf.js/) renders them. Both run in the browser and are fetched only when a file is chosen; the pdf.js worker is bundled with the site, so nothing loads from a third-party CDN.
- Files are identified by their first bytes, not their names, in the browser and on the server.
- Edits are stored in page coordinates as displayed and converted to PDF coordinates on save, including pages stored rotated (`src/lib/coords.ts`).
- Text uses the standard PDF fonts; characters outside their range (for example Yoruba tone marks) switch to a bundled Noto Sans, embedded as a subset.
- The server route (`src/app/api/convert/route.ts`) accepts only the listed conversions, checks the file signature and size, limits each visitor per day by a hashed IP address, and forwards the file to ConvertAPI without storing it, and counts a conversion only when it succeeds. The converted file is returned from this site's own address (`/api/convert/result`, tied to the visitor who made it) and deleted from ConvertAPI as soon as it has been sent.
- Security headers are set for every page (`next.config.ts`).

## Run locally

```bash
npm install
npm run dev
```

Checks: `npm run typecheck`, `npm run lint` (zero warnings), `npm run format:check`, `npm test` (Vitest), `npm run build`, and `npm run e2e` (Playwright, phone and desktop projects; set `PW_CHROMIUM_PATH` to use an installed Chromium). `node scripts/screens.mjs` and `node scripts/screens-states.mjs` take review screenshots.

## Settings

| Name                                                 | Required             | Purpose                                                                                        |
| ---------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `CONVERTAPI_SECRET`                                  | For the server tools | ConvertAPI secret. Without it the server tools answer "not set up".                            |
| `CONVERT_DAILY_PER_VISITOR`                          | No                   | Server conversions allowed per visitor per day (default 10).                                   |
| `CONVERT_DAILY_SITE_CAP`                             | No                   | Server conversions allowed for the whole site per day (default: no cap).                       |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | No                   | Shares the daily counts across server instances. Without them each instance counts on its own. |
| `NEXT_PUBLIC_SITE_URL`                               | Recommended          | Public address, for canonical addresses, the sitemap and link previews.                        |

See `.env.example`.
