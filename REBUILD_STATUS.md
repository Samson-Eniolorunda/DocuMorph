# DocuMorph rebuild: status after session 3

Branch `rebuild/production` (from `v2`). `main` and `v2` have not been touched, no pull request was opened, nothing was merged or deployed.
Written 19 November 2026 (session 3 fixes the findings of a code review of the rebuild; no feature was added).

Session 3 gates, all run on this branch: `format:check` clean; `lint` 0 warnings; `typecheck` 0 errors; `npm test` 102 unit tests pass (23 new); `npm run build` passes; `npm run budgets` passes; `npx playwright test` 173 pass, 3 skipped by design, 0 fail. No real service was called.

## What session 3 fixed (review findings)

1. **Cost.** `CONVERT_DAILY_SITE_CAP` now defaults to 200. Every server tool (Word, Excel, PDF to Word, PDF to Excel) needs the Upstash shared store; without it the tool is off ("This conversion is not set up on this site."). IPv6 visitors are keyed on their /64 prefix (`addressPrefix`, `src/server/http.ts`), and IPv4-mapped addresses are treated as IPv4.
2. **Privacy.** Adobe cleanup deletes the uploaded asset and the result asset, so the privacy page is true.
3. **Protected PDFs.** "Light" compression refuses an encrypted (owner-password) PDF: "This PDF is protected, so it cannot be compressed here." Tested with an owner-password fixture.
4. **Time.** The Adobe budget is 45 s (was 55 s) and the asset deletions run after the response with `after()` from `next/server`.
5. **Refunds.** An Adobe unit is given back only if the failure came before `/operation/exportpdf` was accepted; after that it may have been spent and stays counted.
6. **Feedback.** A site-wide cap of 30 messages a day and the /64 key for IPv6. Feedback still falls back to a per-instance count when Upstash is absent (it costs nothing but e-mail).
7. **Store errors.** A pipeline entry with an error, or a result that is not a number, now throws; the routes already fail closed.
8. **Release day.** `releaseAdobe` uses the day and month of the reservation, not of the release.
9. **pdf.js.** Compress PDF destroys the pdf.js document in `finally` (success, failure and cancel); the loop moved to `src/features/compress-pdf/pictures.ts` so it is unit-tested.
10. **HTTPS.** `GOTENBERG_URL` must be `https://`.
11. **Result size.** Vercel limits a function response to 4.5 MB. A converted file larger than 4,500,000 bytes is refused before sending, with "The converted file is larger than the 4.5 MB this site can send back. Please try a smaller or simpler file.", and the visitor's allowance is given back (Adobe's unit stays counted, because Adobe did the work). This is a real limit: a 4 MB Word file with images can produce a larger PDF and will be refused. Raising it needs a different delivery route (for example a short-lived signed download), which would reintroduce storage, so I have not built it.

**Owner to confirm:** on Adobe's licensing page, how PDF export jobs are counted against the free allowance (per call, or per block of pages). The caps assume one unit per call; if large files count per page block, lower `ADOBE_MONTHLY_CAP`.

## What session 2 did

1. **Owner decisions D1 to D6 and D17 applied** and recorded in `REBUILD_PLAN.md` section 9.1a.
2. **ConvertAPI removed completely** (code, route, secret, tests, text). Replaced by:
   - **Word and Excel to PDF: Gotenberg** (LibreOffice), self-hosted on Cloud Run. `src/server/gotenberg.ts` calls `GOTENBERG_URL` with basic authentication, a shared 55 s time budget, one retry for a service waking from zero (connection failure, 502, 503, 504), and a check that the answer really is a PDF. `infra/gotenberg/README.md` holds the exact owner steps.
   - **PDF to Word and PDF to Excel: Adobe PDF Services**, by its REST interface (`src/server/adobe.ts`): token, asset upload, export job, poll, download, then a best-effort delete. A whole-site **monthly cap (default 450 of the 500 free)** and **daily cap (default 25)** are held in the shared Upstash store; when either is reached the visitor sees "PDF to Word is busy today, please try tomorrow." and neither the visitor's allowance nor Adobe's is spent. Without the shared store these two tools stay off, because a per-instance count could not protect the free allowance.
   - **Compress PDF now runs in the browser** (`src/features/compress-pdf`). Justification: Gotenberg has no compression route, so the choice was Ghostscript on a second service or the browser. The browser needs no server, no quota, no upload, takes files to 100 MB, and is honest about the trade: "Light" re-packs the file and keeps the text selectable (small saving); three "Smaller" levels turn the pages into JPEG pictures at 96, 130 or 170 dpi (large saving, text no longer selectable, said on screen). A result that is not smaller is not offered as one. If better quality is wanted later, Ghostscript can be added to the same Cloud Run image family; I did not build it unasked.
   - The converted file now comes back **in the same response**. There is no result route, no token, no stored file, so "deleted straight after" is true by construction on our side.
   - PDF to Excel was not named in the brief; I kept it (parity item CNV-05) and sent it through Adobe, whose export supports `xlsx`. Say if it should go.
3. **Feedback, Terms, coffee link, footer, licence** (D1 to D5, D17). `/api/feedback` (zod, 5 a day per visitor, honeypot field, size limit, Resend to the owner only, nothing stored), `/terms`, one line under every upload area, footer credit, `LICENSE`, `"license": "UNLICENSED"`.
4. **The remaining plan items**: drag-to-reorder in Organise; page thumbnails in the editor's Pages sheet (tap to go to the page); tapping thumbnails fills the range fields in Split and PDF to images (and typing updates the selection); CSP with a nonce per request (`src/proxy.ts`, `src/lib/csp.ts`); per-tool share images; raster icon set, maskable icon and Apple touch icon (`scripts/icons.mjs`); `NEXT_PUBLIC_SITE_URL` required (a production build stops without it); size budgets enforced in CI (`budgets.json`, `scripts/budgets.mjs`); sheets close on swipe down and on the Android Back gesture.
5. Two defects found and fixed on the way: Merge's drag handle could drop its pointer capture when the list reordered (also fixed in the new Organise drag), and the feedback form's constant pulled the whole `zod` library into the browser bundle (and a CSP violation with it).

## Parity count

**151 of 151 checklist items resolved: 131 built, 20 dropped on purpose by owner decision, 0 open.** The 20: the four defective behaviours (D6: CMP-07, FLW-06, FLW-19, API-04), the automatic feedback pop-up and the consent tick box (FLW-05, FLW-08; replaced by the one-line promise), direct large uploads through Vercel Blob (FLW-13, FLW-14, API-01, API-02, INT-02; D3), "Powered by ConvertAPI" and the social links (LGL-05, LGL-07), and the wallets, coins, QR code and wallet route (DON-02 to DON-06, API-06, INT-04; D2). Items whose behaviour changed by decision are ticked with the change described in section 9.1a.

## Check results (all run on this branch)

| Check | Result |
| --- | --- |
| `npm run lint` (`--max-warnings 0`) | 0 errors, 0 warnings |
| `npm run typecheck` (strict) | 0 errors |
| `npm run format:check` | Clean |
| `npm test` | 79 unit tests pass: every refusal and flow of the convert route (Gotenberg and Adobe mocked, including the cold-start retry, both caps, refunds, no secrets in answers), the feedback route, the environment schema, the CSP builder, ranges and page picking |
| `npx playwright test` | 169 pass, 3 skipped by design (phone-only checks), 0 fail, on phone (390 px) and desktop (1280 px). Includes the CSP run over the home, Terms, Word to PDF, Organise and editor pages with pdf.js and its worker (no violations), Back and swipe on sheets, drag in Organise, thumbnail range picking, feedback success and failure, and share images and icons. A separate axe run over every page including Terms: 74 pass |
| `npm run build` | Passes. Every page is now rendered per request (this is what gives each its own nonce) |
| `npm run budgets` | Passes: home 184.6 KB gzip of script (budget 190), tool pages 192.9 KB (195; editor 200), styles 8.1 KB (12) |
| Horizontal overflow, every page at 360, 390, 430, 768, 1280 and 1536 px, light and dark | None (216 renders) |
| No real conversion, e-mail or Adobe call was made | Every external service is mocked |

### Lighthouse, mobile (local production build, headless Chromium, default throttling; indicative only)

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 100 | 100 | 100 | 100 | 0.8 s | 0 | 70 ms |
| `/edit-pdf` | 100 | 100 | 100 | 100 | 0.8 s | 0 | 50 ms |
| `/merge-pdf` | 100 | 100 | 100 | 100 | 0.8 s | 0 | 70 ms |
| `/word-to-pdf` | 100 | 100 | 100 | 100 | 0.8 s | 0 | 90 ms |
| `/compress-pdf` | 100 | 100 | 100 | 100 | 0.8 s | 0 | 60 ms |
| `/terms` | 100 | 100 | 100 | 100 | 0.8 s | 0 | 50 ms |

These are against a local server. Because the CSP makes pages dynamic, the live site will add a server round trip to each page view that a static page would not have; measure the Vercel preview before relying on these numbers.

## Verdict: is it production level on phones?

**Closer, and good enough for a private preview, but not yet for a public release.** The layout, the touch targets, the forms, the sheets (they now close on swipe and Back) and the new features were looked at on screenshots at six widths in both themes and are tidy; automated accessibility, security-policy and size checks are clean. What still stops me signing it off:

- **Nothing has run on a real iPhone or Android phone.** Everything is desktop Chromium with phone emulation. The dozen device-only questions in the plan are still open: the Word file picker on Android, saving and sharing on iOS, the keyboard against the text sheet, memory with a 100 MB PDF (now allowed on phones, with a warning from 25 MB), and whether the Back gesture and swipe feel right.
- **The server conversions are unproven against the real services.** The Gotenberg and Adobe code follows their documented flows, but I could not reach either site's documentation from this environment, so the flag names, the Adobe request fields and the asset-delete call are written from knowledge and third-party guides, and the Gotenberg README says so. The first real conversion on a preview is the real test, and Cloud Run's cold start (several seconds) should be timed.
- **Adobe's free tier**: I have assumed 500 transactions a month. Please read the terms on your account page, since some free allowances are time-limited trials; if so, PDF to Word and PDF to Excel are not free for ever and should be reconsidered.
- **Compress PDF "Smaller" turns pages into pictures.** That is honest and fast, but a text-heavy PDF loses its selectable text. If that is not acceptable, the alternative is Ghostscript on a second Cloud Run service.
- **The 4 MB server limit is Vercel's**, not the converters'. A larger limit needs a different upload route.
- The privacy page states that Adobe removes files straight after and in any case within 24 hours. Please confirm this against Adobe's current terms before publishing.
- Still not built, as before: custom pinch zoom with a sharp re-render, text-sheet placement above the keyboard, editor drafts (D14), offline cache (D11), the `pdf-lib` fork evaluation (D12), an independent review.

## Owner steps (exact, in order)

**1. Cloud Run (Word and Excel to PDF).** Follow `infra/gotenberg/README.md` from the top: create the project, mirror and deploy the image (2 GiB, 1 vCPU, concurrency 1, min 0, max 2, `europe-west1`, basic authentication on), run the two `curl` checks, create the £5 budget alert. It ends with three values for Vercel: the service address, the username, the password.

**2. Adobe account.** Sign in at Adobe's developer console (developer.adobe.com, Document Services), create a project, add the **PDF Services API**, and copy the **Client ID** and **Client Secret**. Read the free-tier terms on the page.

**3. Upstash (shared counts, required for every server tool: Word and Excel to PDF as well as the Adobe ones).** Create a free Redis database at upstash.com, region near your Vercel region. Copy its **REST URL** and **REST token**.

**4. Resend (feedback).** Create an account **with the e-mail address that should receive feedback**, make an API key with sending access, and put that same address in `FEEDBACK_TO_EMAIL`. Without a verified domain Resend only delivers to that account address, which is exactly this use.

**5. Buy Me a Coffee.** Create the page and copy its address into `NEXT_PUBLIC_BUYMEACOFFEE_URL`. Until then no coffee link appears anywhere.

**6. Portfolio.** Put the address of your portfolio in `NEXT_PUBLIC_PORTFOLIO_URL`. Until then your name in the footer is plain text.

**7. Vercel environment variables** (Settings, Environment Variables, Production and Preview; values are never committed):

| Name | Needed for |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | **Required.** The `https://...vercel.app` address. The build stops without it |
| `NEXT_PUBLIC_PORTFOLIO_URL`, `NEXT_PUBLIC_BUYMEACOFFEE_URL` | Optional links |
| `GOTENBERG_URL`, `GOTENBERG_USERNAME`, `GOTENBERG_PASSWORD` | Word and Excel to PDF |
| `PDF_SERVICES_CLIENT_ID`, `PDF_SERVICES_CLIENT_SECRET` | PDF to Word and PDF to Excel |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shared counts; the Adobe tools stay off without them |
| `ADOBE_MONTHLY_CAP`, `ADOBE_DAILY_CAP` | Optional; defaults 450 and 25 |
| `RESEND_API_KEY`, `FEEDBACK_TO_EMAIL` | Feedback |
| `CONVERT_DAILY_PER_VISITOR`, `CONVERT_DAILY_SITE_CAP` | Optional; defaults 10 a visitor and **200 a day for the whole site** (the cap protects the Cloud Run bill; `0` turns it off) |

Remove `CONVERTAPI_SECRET` from Vercel if it is still set; nothing reads it now. `BLOB_READ_WRITE_TOKEN`, `FORMSPREE_ENDPOINT` and the `WALLET_*` names are also unused.

**8. Then**: deploy the branch as a **preview** (not production), convert one real Word file, one Excel file and one PDF to Word, send one feedback message, and open the site on a real iPhone and a real Android phone.

## Still needed from the owner

- Approval of the privacy text (now naming Gotenberg on Google Cloud, Adobe and Resend) and of the new Terms text, with a contact address if one is to be published.
- Decisions not yet taken: D7 BMP and TIFF, D8 daily limit (kept at 10, shown), D11 offline use, D12 the `pdf-lib` fork, D14 editor drafts, D18 who releases.
- Sample files without personal data (Word, Excel, a form PDF, a password-protected PDF, a large PDF, HEIC and large phone photographs), and an iPhone and an Android phone for the device checks.
