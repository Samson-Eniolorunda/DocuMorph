# DocuMorph rebuild: status

Branch `rebuild/production` (from `v2`). `main` and `v2` have not been touched, no pull request was opened, nothing was merged or deployed.
Written 18 November 2026.

## Phases completed

| Phase | Commit | State |
| --- | --- | --- |
| 0. Make the base pass | `7541e04`, `2d345f0` | Done, except the LICENSE (needs D17) |
| 1. Design system and shell | `d9cb91a` | Done |
| 2. Server | `d9cb91a`, `311c4ab` | Done and tested with a stubbed ConvertAPI; live behaviour not checked |
| 3. Files and the nine simpler tools | `d9cb91a`, `e0afb91` | Done, except drag-to-reorder of pages in Organise |
| 4. PDF editor on a phone | `d9cb91a`, `e0afb91` | Largely done; see "Not done" |
| 5. Items live on `main` | not started | Waiting on the owner (D1 to D5) |
| 6. Metadata, security, performance | `f845cba` | Part done: sitemap, robots, manifest, canonical addresses. No CSP, no per-tool share images, no icon set, no offline cache |
| 7. Verification and release | partly | Own end-to-end and accessibility tests pass; no real-device run, no independent review |

Commits `d9cb91a` to `e0afb91` contain work from phases 1 to 4 together, because the new components replaced the old classes everywhere at once.

## Parity count

**118 of 151 ticked** in `REBUILD_PLAN.md`. The 33 not ticked:

- Waiting on the owner: feedback (FBK-01 to 05, NAV-04, FLW-05, API-05, INT-03), donations (DON-01 to 06, API-06, INT-04), large uploads (FLW-13, FLW-14, API-01, API-02, INT-02), Terms and consent (LGL-01, LGL-03, FLW-08), footer credits (LGL-05 to 07).
- Defective on `main`, to stay out once the owner confirms (D6): CMP-07, FLW-06, FLW-19, API-04.
- NAV-06 is partly done: the phone menu lists the tools, but not Feedback or Donate.

Ticks for CNV-02 to 05 and SRV-01 rest on tests with a stubbed ConvertAPI. No real conversion was run.

## Check results (all run on this branch)

| Check | Result |
| --- | --- |
| `npm run lint` (`--max-warnings 0`) | 0 errors, 0 warnings. Was 1,574 problems on `v2` |
| `npm run typecheck` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | 0 errors |
| `npm run format:check` | Clean |
| `npm test` | 58 unit tests pass (26 inherited plus history, environment schema, every route refusal and the result route, phone limits, HEIC) |
| `npx playwright test` | 134 pass, 2 skipped by design (phone-only checks), on phone (Pixel 7, 390 px) and desktop (1280 px) |
| `npm run build` | Passes, 25 pages, no warnings, no environment variable needed |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Server variable names in `.next/static` | None found |
| Banned patterns in `src` (`any`, ts-ignore, eslint-disable, `as unknown as`, console.log, TODO, non-null `!`) | None |
| Horizontal overflow, every page at 360, 390, 430, 768, 1280 and 1536 px, light and dark (204 renders) | None |
| axe (WCAG 2.2 AA tags), every page in light and dark, plus the editor with its sheets | 0 violations |
| Touch targets on phone project | Every button, input and select on the home page, Merge, Resize and Word to PDF is 44 px or more |
| Bundle | Home page: 181 KB gzip of script (budget 170 KB; about 150 KB of it is the React and Next runtime). CSS 8 KB. No third-party requests. `pdf-lib` and `pdf.js` load only when a file is chosen |

### Lighthouse, mobile (local production build, headless Chromium, default throttling; indicative only, not the Vercel preview)

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 100 | 100 | 100 | 100 | 0.8 s | 0 | 80 ms |
| `/edit-pdf` | 100 | 100 | 100 | 100 | 0.8 s | 0 | 80 ms |
| `/merge-pdf` | 99 | 100 | 100 | 100 | 0.8 s | 0 | 120 ms |
| `/resize-image` | 99 | 100 | 100 | 100 | 0.8 s | 0 | 130 ms |
| `/word-to-pdf` | 99 | 100 | 100 | 100 | 0.8 s | 0 | 140 ms |
| `/privacy` | 100 | 100 | 100 | 100 | 0.8 s | 0 | 80 ms |

The other pages were not measured. The editor with a PDF open was not profiled.

## What changed (summary)

- Lint fixed at its cause: the PDF worker is bundled, the copy script is gone. Folder structure now follows the plan (`config`, `server`, `schemas`, `features`, `components/ui`, `components/layout`, `tests`). One route and one registry serve all fourteen tools.
- Design system: tokens for colour (contrast-fixed), type, radius and shadow; 16 px text; one Button, IconButton, Field, Select, RadioGroup, Checkbox, Slider, Stepper, Dialog and sheet, Notice, ProgressBar, Badge. Solid 56 px header, a "Tools" sheet, a bottom action bar with safe-area padding, `viewport-fit=cover`, reduced-motion support.
- Server: zod-validated environment (a mistyped limit now fails closed with 503), zod request schema, conversion counted only on success, results returned from the site's own address with a per-visitor token and deleted from ConvertAPI once sent, result and delete calls limited, upload progress, cancel, time limit, offline message, retry that keeps the file.
- Files: real "Choose" button (visible focus), HEIC explained, Office MIME types, "Take a photo" in Images to PDF, large-PDF warning on phones, canvas pixel cap with a note, touch drag-to-reorder plus arrows, Save and Share, in-app-browser warning, pixel size before and after.
- Editor: full-screen on a phone with a slim top bar and a labelled bottom tool bar; one finger scrolls and the browser's pinch zoom works unless a box tool is armed (tools disarm after use); `pointercancel` and second-finger handling; text, colour, form, page and signature sheets with 16 px fields; 44 px handles; move by buttons or arrow keys; smoothed signature strokes stored as points and redrawn on resize; one bundled script face for typed signatures; own dialog replaces `confirm()`; history extracted into a tested module.

## Not done, or only partly done

- Custom pinch zoom with sharp re-render and double-tap zoom: the editor relies on the browser's own zoom, which does not re-render the page sharper.
- Text sheet position above the keyboard from `visualViewport`: the sheet is a standard bottom sheet; its behaviour with the keyboard is untested on a device.
- Swipe-down and Android back-gesture closing of sheets.
- Drag-to-reorder pages in Organise (Earlier and Later buttons work).
- Page-thumbnail navigator (a page list sheet exists).
- Tapping thumbnails to fill range fields.
- Editor drafts (D14), offline cache (D11): not built; both need the owner's yes and a privacy text.
- Content-Security-Policy, per-tool share images, raster icon set and Apple touch icon, `NEXT_PUBLIC_SITE_URL` made required, budgets enforced in CI.
- Secret in a header instead of the query string (SEC-V2): left as it was, because ConvertAPI's documentation could not be reached from this environment to confirm the header is accepted.
- Evaluation of the `pdf-lib` fork (D12): not done; stays on 1.17.1.
- `LICENSE` (D17).
- The Playwright suite runs ConvertAPI stubbed; the network assertion shows the device tools send no file and contact no other origin (tested on Merge).
- The npm audit of development packages was not reviewed.

## Verdict: is it production level on phones?

Not yet, and I would not release it on this evidence alone. The shell, the home page and the eight simpler tools are in good shape: they are laid out for a thumb, pass automated accessibility and touch-size checks on a phone-sized browser, and score 99 to 100 in Lighthouse locally. The server route is much safer than `v2` and is well tested.

Three things stop me calling it finished. First, nothing has been run on a real iPhone or Android phone, and the plan lists a dozen behaviours that only a device can confirm (the file picker for Word files on Android, HEIC choices, saving and sharing, the keyboard with the text sheet, memory with large PDFs). Everything here was tested in desktop Chromium with phone emulation. Second, the editor works and is far more usable than before, but its zoom is the browser's own and I could not judge the feel of touch drawing and dragging. Third, no live ConvertAPI call has been made, and there has been no independent review. The screenshots in `docs/rebuild-screens/` look clean and consistent to me, but they are my own judgement.

## Needed from the owner

Decisions (section 9.1): D1 feedback form, D2 donations and wallets, D3 large files, D4 Terms and consent, D5 footer credit and social links, D6 confirm the four defective behaviours stay out, D7 BMP and TIFF, D8 daily limit (I kept 10 and show the remainder), D11 offline use, D12 `pdf-lib` fork, D14 editor drafts, D17 licence (add a `LICENSE`), D18 who releases. I applied the plan's recommendations for D9, D10, D13 (automatic deletion), D15 (camera button) and D16; say if any should change.

Content and assets: approval of the revised privacy text (dated 18 November 2026, no contact address yet); Terms text if D4 is yes; a contact address if one is to be published; whether the typed-signature face (Dancing Script, open licence) is acceptable; sample files without personal data (Word and Excel files, a form PDF, a rotated PDF, a password-protected PDF, a PDF over 50 MB, HEIC and large phone photographs).

Accounts and access: the production domain (and DNS if custom), confirming which environment variables are set on Vercel (names only), permission for preview deployments from this branch, a ConvertAPI test secret for previews, whether the plan requires the "Powered by" credit, an Upstash database or agreement that the limit stays approximate, and access to an iPhone and a mid-range Android phone.

Network: allowing `www.convertapi.com` so ConvertAPI's authentication documentation can be read, to settle whether the secret may move to a header.
