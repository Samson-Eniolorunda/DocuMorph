# DocuMorph — Rebuild Plan

> **The base is `v2`. This is the owner's decision.** The rebuild starts from the code on `origin/v2` (the
> Next.js preview that was never merged), not from `main`. `main` remains the live site and stays exactly as
> it is until the owner approves a release. **Neither `main` nor `v2` is modified**: all work happens on
> `rebuild/production`, which was reset to `origin/v2` for this purpose.

| | |
| --- | --- |
| Repository | `Samson-Eniolorunda/DocuMorph` |
| Working branch | `rebuild/production` (identical to `origin/v2` at commit `81fd102`) |
| Base for the rebuild | `origin/v2` — Next.js 16, React 19, TypeScript, Tailwind CSS 4 (61 tracked files) |
| Live site | `origin/main` at commit `83683a1` (12 tracked files), read with `git show`, never checked out |
| Date of this revision | 18 November 2026 |
| Status | Audit and plan only. Nothing has been rebuilt. |

**How the evidence was gathered.** Every tracked file on `v2` was read in full for this revision, and `v2` was
installed, built, linted, type-checked and tested in the working tree (section 4). `main` was read in full for
the first version of this plan; its line references are carried over from that reading and were spot-checked
again today against `git show origin/main:<path>` (viewport, inputs, media queries, `package.json`,
`.gitignore`). References are written as `path:line`. A plain path (for example `src/lib/files.ts:46`) refers to
`v2`, which is the working tree; a path prefixed `main:` (for example `main:index.html:13`) refers to the live
site.

**Reading the checklist (session 2).** `[x]` is done, including where an owner decision changed how it works. `[-]` is dropped on purpose by an owner decision (section 9.1a). `[ ]` is still open.

**Priority.** Most of DocuMorph's customers use phones. The mobile experience is therefore the first measure of
this rebuild; section 13 sets it out and section 14 makes it a condition of release.

---

## 1. Product summary

DocuMorph is a free, no-account web tool for everyday document and image jobs. Two versions exist.

**The live site (`main`)** is a single page with four tools, all of which send the file to a server:

| Tool | What it does | Where the work happens |
| --- | --- | --- |
| Convert | Word to PDF, PDF to Word, Excel to PDF, PDF to Excel, JPG to PNG, PNG to JPG | ConvertAPI |
| Compress | PDF or image, by a 1–9 slider or (for images) a target size in MB/KB | ConvertAPI |
| Resize | Images by width/height in pixels or by 75 %, 50 %, 25 % scale | ConvertAPI |
| Merge | Several PDFs into one | ConvertAPI |

Files are uploaded from the browser to Vercel Blob storage and passed through a serverless proxy to
ConvertAPI. Around the tools there is a feedback form (Formspree), a crypto-donation dialog (twelve wallet
addresses from environment variables, with a QR code), Terms of Service and Privacy Policy dialogs, and a limit
of five jobs per day kept in the browser's local storage.

**The base for the rebuild (`v2`)** has fourteen tools, each on its own address (`src/lib/tools.ts:16-27`):

| Group | Tools | Where the work happens |
| --- | --- | --- |
| Edit and organise | Edit PDF, Merge PDF, Split PDF, Organise pages | On the visitor's device (`pdf-lib`, `pdf.js`) |
| Convert | Images to PDF, PDF to images | On the visitor's device |
| Images | Convert image, Resize image, Compress image | On the visitor's device (canvas) |
| Office and compression | Word to PDF, PDF to Word, Excel to PDF, PDF to Excel, Compress PDF | ConvertAPI, through one locked-down route, files up to 4 MB (`src/lib/files.ts:48`) |

`v2` has a privacy page, light and dark themes with a manual switch, security headers and 26 unit tests. It
has **no** feedback form, donation dialog, Terms of Service, consent checkbox, Vercel Blob upload or upload
progress; these exist only on `main` (section 2.3).

**Audience** (inferred from the copy and features): members of the public who need to sign, fill in, merge or
convert a document on a phone without installing an app or creating an account. The files are often personal —
the home page names "contracts, IDs and payslips" (`src/app/page.tsx:52-53`). It is a personal project by
Samson Eniolorunda, hosted on Vercel.

There are no user accounts, no database, no admin area and no payments in either version.

---

## 2. Feature inventory (parity checklist)

**Total: 151 checklist items — 39 marked `main`, 47 marked `both`, 65 marked `v2`.**

- **`main`** — live today, absent from `v2`. Each is either restored by the rebuild or confirmed by the owner as
  dropped on purpose (section 2.3 and section 9). None is dropped silently.
- **`both`** — live today and present in `v2`, sometimes in a changed form (noted beside the item and collected
  in section 2.4).
- **`v2`** — exists only in `v2`. It is real, working code and must still work after the rebuild.

This is the contract. Items marked *(decision)* work on `main` in a way that is defective or misleading; the
checklist keeps the capability and section 9 asks the owner how it should behave.

### 2.1 Items live on `main` (86: 39 `main`, 47 `both`)

#### A. Shell and navigation

- [x] **NAV-01** `both` — Start page at `/` with sticky header and footer (`main:index.html:53-653`; `src/components/Header.tsx:35`, `src/components/Footer.tsx:6`). In `v2` the start page is the list of tools, not a tool.
- [x] **NAV-02** `both` — Logo and "DocuMorph" wordmark link to the start page (`main:index.html:60-63`; `src/components/Header.tsx:37-39`).
- [x] **NAV-03** `main` — Header navigation naming the tools, with the current one highlighted (`main:index.html:65-85`). `v2` shows only "All tools" and "Privacy", and only from 640 px (`src/components/Header.tsx:41-46`).
- [x] **NAV-04** `main` — "Feedback" item in the header opening the feedback dialog (`main:index.html:86-88`).
- [x] **NAV-05** `main` — Menu button on phones opening a full-screen menu (`main:index.html:91-98`, `main:assets/css/styles.css:285-340`). `v2` has no phone menu.
- [x] **NAV-06** `main` — Phone menu items: the four tools, Feedback and Donate (`main:index.html:103-166`).
- [x] **NAV-07** `both` — Moving to another tool discards the file and settings of the previous one (`main:assets/js/scripts.js:324-341`; in `v2` each tool is a separate page).
- [x] **NAV-08** `both` — Light and dark appearance following the device setting (`main:index.html:15`; `src/app/layout.tsx:29`, `src/app/globals.css:4-33`).
- [x] **NAV-09** `both` — Responsive layout (`main:assets/css/styles.css:1417-1668`; Tailwind `sm`/`md`/`lg` classes throughout `v2`).

#### B. Convert

- [x] **CNV-01** `both` — A way to choose among the conversions (`main:index.html:171-212`; `v2`: the tool list, `src/app/page.tsx:65-93`).
- [x] **CNV-02** `both` — Word to PDF, `.doc` and `.docx` (`main:assets/js/scripts.js:386-390`; `src/lib/server-tools.ts:22-30`).
- [x] **CNV-03** `both` — PDF to Word (`main:assets/js/scripts.js:391-394`; `src/lib/server-tools.ts:31-39`).
- [x] **CNV-04** `both` — Excel to PDF, `.xls` and `.xlsx` (`main:assets/js/scripts.js:395-398`; `src/lib/server-tools.ts:40-48`).
- [x] **CNV-05** `both` — PDF to Excel (`main:assets/js/scripts.js:399-402`; `src/lib/server-tools.ts:49-57`).
- [x] **CNV-06** `both` — JPG to PNG (`main:assets/js/scripts.js:403-406`; `v2`: Convert image, in the browser, `src/tools/ImageTool.tsx:17-21`).
- [x] **CNV-07** `both` — PNG to JPG (`main:assets/js/scripts.js:407-410`; `src/tools/ImageTool.tsx:17-21`).
- [x] **CNV-08** `both` — The file picker is filtered to the tool's file types and a hint line names them and the size limit (`main:assets/js/scripts.js:372-436`; `src/components/Dropzone.tsx:40`, `:85-89`).

#### C. Compress

- [x] **CMP-01** `both` — Compress a PDF or an image (`main:index.html:215-239`; `v2`: `/compress-pdf` and `/compress-image`).
- [x] **CMP-02** `both` — Choice between compressing by quality and to a target size (`main:index.html:244-265`; `src/tools/ImageTool.tsx:127-134`, images only).
- [x] **CMP-03** `both` — A quality control with a live value (`main:index.html:268-286`: slider 1–9 with words; `v2`: 10–100 % slider for images, `src/tools/ImageTool.tsx:157-160`, and three named presets for PDFs).
- [x] **CMP-04** `both` — PDF compression presets `screen`, `ebook`, `printer` (`main:assets/js/scripts.js:743-749`; `src/lib/server-tools.ts:66-75`).
- [x] **CMP-05** `both` — Image compression for JPEG, PNG and WebP (`main:assets/js/scripts.js:420`, `:753-762`; `src/tools/ImageTool.tsx:81`). BMP and TIFF input exist on `main` only.
- [x] **CMP-06** `both` — Image compression to a target size (`main:index.html:289-317`, MB or KB; `src/tools/ImageTool.tsx:135-139`, KB only).
- [-] **CMP-07** `main` *(decision)* — "Target Size" offered for PDFs but ignored (`main:assets/js/scripts.js:750-752`). `v2` does not offer it, which is the recommended outcome.
- [x] **CMP-08** `both` — The file's size is shown before starting (`main:assets/js/scripts.js:520-521`; `src/tools/ServerConvert.tsx:88-90`, `src/components/FileOrder.tsx:40`). The `v2` image tools show only a count (`src/tools/ImageTool.tsx:85-86`).
- [x] **CMP-09** `both` — Result shows the original size, the new size and the saving (`main:index.html:547-559`; `src/components/Results.tsx:27-31`, `src/tools/ServerConvert.tsx:58-60`).

#### D. Resize

- [x] **RSZ-01** `both` — Width and height in pixels; a blank field means automatic (`main:index.html:322-349`; `src/tools/ImageTool.tsx:104-111`).
- [x] **RSZ-02** `both` — Resize by percentage (`main:index.html:351-380`: 100/75/50/25 %; `src/tools/ImageTool.tsx:117-120`: slider 5–200 %).
- [x] **RSZ-03** `both` — The output keeps the input format (`main:assets/js/scripts.js:780-782`; `src/tools/ImageTool.tsx:25`, `:148`). BMP and TIFF input exist on `main` only.
- [x] **RSZ-04** `main` — The image's pixel dimensions are shown before starting (`main:assets/js/scripts.js:522-531`).
- [x] **RSZ-05** `main` — Result shows the original and new dimensions (`main:index.html:561-573`). `v2` shows file sizes only (`src/components/Results.tsx:27-31`).

#### E. Merge

- [x] **MRG-01** `both` — Merge PDFs (`main:index.html:385-406`; `src/tools/MergePdf.tsx:14-51`).
- [x] **MRG-02** `both` — Several PDFs picked or dropped at once, used in order (`main:assets/js/scripts.js:970-975`; `src/tools/MergePdf.tsx:37`).
- [x] **MRG-03** `both` — The selection is summarised with a count (`main:assets/js/scripts.js:534-537`; `src/tools/MergePdf.tsx:45`).

#### F. File selection and job flow

- [x] **FLW-01** `both` — Drop zone with a highlight while dragging (`main:index.html:409-445`; `src/components/Dropzone.tsx:63-77`).
- [x] **FLW-02** `both` — Button opening the device file picker, filtered to the tool (`main:index.html:426-432`; `src/components/Dropzone.tsx:90`).
- [x] **FLW-03** `both` — Unsupported files are refused with an inline message naming them (`main:assets/js/scripts.js:222-275`; `src/components/Dropzone.tsx:50-56`, `:92-96`, checked by file signature).
- [x] **FLW-04** `both` — Over-size files are refused with a message (`main:assets/js/scripts.js:180-188`: 50 MB; `src/components/Dropzone.tsx:53`: 100 MB on the device, 4 MB for server tools, `src/lib/files.ts:46-48`).
- [-] **FLW-05** `main` — Repeated rejections open the feedback dialog (`main:assets/js/scripts.js:238-246`).
- [-] **FLW-06** `main` *(decision)* — "Uploading…" staging animation that is only a timer (`main:assets/js/scripts.js:498-510`). `v2` has none; recommended to stay removed.
- [x] **FLW-07** `both` — Ready screen showing the chosen file (`main:index.html:458-468`; `src/tools/ServerConvert.tsx:87-90`).
- [-] **FLW-08** `main` — Consent checkbox "I agree to the Terms & Privacy Policy" gating the start button (`main:index.html:471-482`).
- [x] **FLW-09** `both` — Start button labelled for the tool (`main:assets/js/scripts.js:539-544`; `src/tools/ServerConvert.tsx:106`, `src/tools/ImageTool.tsx:168`).
- [x] **FLW-10** `both` — A way back to choose another file (`main:index.html:495-497`; `src/tools/ServerConvert.tsx:108-110`, `src/tools/ImageTool.tsx:87-89`).
- [x] **FLW-11** `main` — Processing screen with a percentage and a progress bar (`main:index.html:502-509`). `v2` shows a spinner in the button (`src/tools/ServerConvert.tsx:106`).
- [x] **FLW-12** `main` — Real upload progress (`main:assets/js/scripts.js:963-989`).
- [-] **FLW-13** `main` — Direct browser upload to Vercel Blob for files up to 50 MB (`main:assets/js/scripts.js:910-961`).
- [-] **FLW-14** `main` — Separate iPhone/iPad upload route (`main:assets/js/scripts.js:845-908`).
- [x] **FLW-15** `both` — Conversion request to `/api/convert` (`main:assets/js/scripts.js:991-1008`; `src/tools/ServerConvert.tsx:25-29`).
- [x] **FLW-16** `both` — Failures are reported to the person (`main:assets/js/scripts.js:1012-1037`, by alert; `src/components/Results.tsx:68-75`, inline).
- [x] **FLW-17** `both` — Success screen with download and start again (`main:index.html:512-532`; `src/components/Results.tsx:49-63`, `src/tools/ServerConvert.tsx:61-73`).
- [x] **FLW-18** `both` — The output file name is shown (`main:index.html:544-545`; `src/components/Results.tsx:39`).
- [-] **FLW-19** `main` *(decision)* — Result preview area that is never displayed (`main:index.html:534-542`). `v2` has none.
- [x] **FLW-20** `both` — Daily limit on conversions (`main:assets/js/scripts.js:292-317`: five, local storage; `src/app/api/convert/route.ts:18`, `:60-74`: ten by default, enforced on the server, server tools only).

#### G. Feedback

- [x] **FBK-01** `main` — Feedback dialog reachable from the header, the phone menu and the footer (`main:index.html:766-845`).
- [x] **FBK-02** `main` — Category chooser: New Tool, Bug Report, Feedback, Other (`main:index.html:779-816`).
- [x] **FBK-03** `main` — Optional e-mail address field (`main:index.html:818-827`).
- [x] **FBK-04** `main` — Required message field (`main:index.html:829-839`).
- [x] **FBK-05** `main` — Submission to `/api/form` with sending, sent and failed states (`main:assets/js/scripts.js:354-370`).

#### H. Donations

- [x] **DON-01** `main` — Donation dialog reachable from the phone menu, the footer and the success screen (`main:index.html:847-1006`).
- [-] **DON-02** `main` — Coin chooser with seven entries (`main:index.html:866-938`).
- [-] **DON-03** `main` — USDT network chooser with six networks (`main:index.html:940-969`).
- [-] **DON-04** `main` — Wallet address for the chosen coin, loaded from `/api/wallets` (`main:index.html:971-981`, `main:assets/js/scripts.js:1136-1164`).
- [-] **DON-05** `main` — QR code of the address (`main:assets/js/scripts.js:1165-1175`).
- [-] **DON-06** `main` — Copy controls with a "Copied!" confirmation (`main:assets/js/scripts.js:1182-1195`).

#### I. Legal content, dialogs and footer

- [x] **LGL-01** `main` — Terms of Service, six sections (`main:index.html:669-732`).
- [x] **LGL-02** `both` — Privacy Policy (`main:index.html:733-764`, a dialog; `src/app/privacy/page.tsx:9-48`, a page, rewritten).
- [x] **LGL-03** `main` — Terms and Privacy open as dialogs that close from a button or the backdrop (`main:assets/js/scripts.js:343-352`).
- [x] **LGL-04** `both` — Footer links (`main:index.html:585-608`: Terms, Privacy, Feedback, Donate; `src/components/Footer.tsx:10-18`: Privacy, Source code, Built by).
- [-] **LGL-05** `main` — "Powered by ConvertAPI" credit linking to convertapi.com (`main:index.html:610-618`).
- [x] **LGL-06** `main` — Copyright line with the current year (`main:index.html:620-622`).
- [-] **LGL-07** `main` — Social links to LinkedIn, GitHub and X (`main:index.html:625-650`).

#### J. API endpoints

- [-] **API-01** `main` — `POST /api/blob-upload`, token handshake for Vercel Blob (`main:api/blob-upload.js:87-197`).
- [-] **API-02** `main` — `POST /api/native-upload`, one multipart file into Vercel Blob (`main:api/native-upload.js:16-84`).
- [x] **API-03** `both` — `POST /api/convert` calling ConvertAPI with the server-held secret (`main:api/convert.js:102-158`, JSON with a file URL; `src/app/api/convert/route.ts:29-101`, a multipart file and a listed tool).
- [-] **API-04** `main` *(decision)* — The open multipart mode of `/api/convert` that streams anything to ConvertAPI (`main:api/convert.js:160-210`). Recommended to stay retired.
- [x] **API-05** `main` — `POST /api/form`, forwarding feedback to Formspree (`main:api/form.js:11-47`).
- [-] **API-06** `main` — `GET /api/wallets`, the twelve wallet addresses (`main:api/wallets.js:12-39`).

#### K. Integrations and hosting

- [x] **INT-01** `both` — ConvertAPI v2 with the secret kept on the server (`main:api/convert.js:56-57`; `src/app/api/convert/route.ts:30`, `:81`).
- [-] **INT-02** `main` — Vercel Blob (`main:api/blob-upload.js:126`).
- [x] **INT-03** `main` — Formspree (`main:api/form.js:18`).
- [-] **INT-04** `main` — QR code generation for wallet addresses (`main:assets/js/scripts.js:1172`).
- [x] **INT-05** `both` — Deployment on Vercel (`main:README.md:113-118`; `src/app/api/convert/route.ts:15-16`).

#### L. Search and sharing metadata

- [x] **SEO-01** `both` — Page title, description and author (`main:index.html:17-27`; `src/app/layout.tsx:11-20`).
- [x] **SEO-02** `both` — Open Graph title and description (`main:index.html:28-32`; `src/app/layout.tsx:18`).
- [x] **SEO-03** `both` — Favicon (`main:index.html:34-38`; `src/app/icon.svg`).

### 2.2 Items that exist only in `v2` (65, all marked `v2`)

#### M. Shell (7)

- [x] **SHL-01** `v2` — Home page listing all fourteen tools in four groups, each a card with name, summary and a "Processed on a server" badge where it applies (`src/app/page.tsx:65-93`, `src/lib/tools.ts:16-29`).
- [x] **SHL-02** `v2` — Home introduction: heading, one paragraph, "Edit a PDF" and "See all tools", and the line "9 of 14 tools never upload your files" (`src/app/page.tsx:44-63`).
- [x] **SHL-03** `v2` — Every tool on its own address with an "All tools" link, a title, a summary and a badge saying where the file is processed (`src/components/ToolShell.tsx:6-35`).
- [x] **SHL-04** `v2` — Manual light/dark switch, remembered in local storage under `theme` and applied before the first paint (`src/components/Header.tsx:15-31`, `src/app/layout.tsx:29`, `:35`).
- [x] **SHL-05** `v2` — "Skip to content" link (`src/app/layout.tsx:38-40`).
- [x] **SHL-06** `v2` — Header links "All tools" and "Privacy" (`src/components/Header.tsx:41-46`).
- [x] **SHL-07** `v2` — Footer statement that most tools do not upload files, with Privacy, Source code and "Built by" links (`src/components/Footer.tsx:8-18`).

#### N. Edit PDF, `/edit-pdf` (23)

- [x] **EDT-01** `v2` — Open a PDF of up to 100 MB; pages are drawn as they come into view (`src/tools/editor/PdfEditor.tsx:268`, `src/tools/editor/EditorPage.tsx:39-57`).
- [x] **EDT-02** `v2` — Toolbar of seven tools (Select, Text, Cover, Highlight, Box, Image, Sign) with a hint line for the current one (`src/tools/editor/PdfEditor.tsx:32-40`, `:291-303`, `:370`).
- [x] **EDT-03** `v2` — Text: place, type, and set font (sans, serif, mono), size 6–96 pt, bold and colour (`src/tools/editor/PdfEditor.tsx:141-148`, `:329-353`).
- [x] **EDT-04** `v2` — Cover existing content with a filled box and retype over it (`src/tools/editor/PdfEditor.tsx:35`, `src/tools/editor/EditorPage.tsx:71-73`).
- [x] **EDT-05** `v2` — Highlight (`src/lib/pdf/ops.ts:226`).
- [x] **EDT-06** `v2` — Outline box (`src/lib/pdf/ops.ts:227`).
- [x] **EDT-07** `v2` — Colour of a cover, highlight or box (`src/tools/editor/PdfEditor.tsx:356-366`).
- [x] **EDT-08** `v2` — Place a PNG, JPG or WebP image (`src/tools/editor/PdfEditor.tsx:158-167`, `:373-388`).
- [x] **EDT-09** `v2` — Signature drawn by hand, trimmed to its ink (`src/tools/editor/SignaturePad.tsx:19-46`, `:158-197`).
- [x] **EDT-10** `v2` — Signature typed as a name in a script face (`src/tools/editor/SignaturePad.tsx:108-120`, `:200-212`).
- [x] **EDT-11** `v2` — Signature from an uploaded photo or scan (`src/tools/editor/SignaturePad.tsx:122-129`, `:214-219`).
- [x] **EDT-12** `v2` — Select, move and resize items; images keep their proportions (`src/tools/editor/EditorPage.tsx:98-121`).
- [x] **EDT-13** `v2` — Delete the selected item by button or key (`src/tools/editor/PdfEditor.tsx:130-135`, `:235-237`, `:312`).
- [x] **EDT-14** `v2` — Undo and redo, up to 100 steps, by button and keyboard (`src/tools/editor/PdfEditor.tsx:107-126`, `:228-234`, `:306-311`).
- [x] **EDT-15** `v2` — Detect and fill PDF form fields: text, multi-line text, tick boxes and choices (`src/lib/pdf/ops.ts:105-116`, `src/tools/editor/PdfEditor.tsx:410-435`).
- [x] **EDT-16** `v2` — Lock (flatten) the form when saving (`src/tools/editor/PdfEditor.tsx:436-439`, `src/lib/pdf/ops.ts:244`).
- [x] **EDT-17** `v2` — Mark pages for deletion or keep them; at least one page stays (`src/tools/editor/PdfEditor.tsx:457-470`, `src/lib/pdf/ops.ts:246-248`).
- [x] **EDT-18** `v2` — Save as `<name>-edited.pdf`, then continue editing and save again (`src/tools/editor/PdfEditor.tsx:201-220`, `:405-408`).
- [x] **EDT-19** `v2` — Edits land where they were placed, including on pages stored rotated (`src/lib/coords.ts:28-52`, `src/tools/editor/types.ts:29-37`).
- [x] **EDT-20** `v2` — Characters outside the standard PDF fonts (for example Yoruba tone marks) are written with a bundled Noto Sans, embedded as a subset (`src/lib/pdf/ops.ts:202-213`, `src/tools/editor/PdfEditor.tsx:210`).
- [x] **EDT-21** `v2` — Warnings before losing unsaved changes, on closing the PDF and on leaving the page (`src/tools/editor/PdfEditor.tsx:91`, `:256-261`).
- [x] **EDT-22** `v2` — Escape clears the selection (`src/tools/editor/PdfEditor.tsx:238-241`).
- [x] **EDT-23** `v2` — Password-protected and damaged PDFs are explained in a sentence (`src/components/Results.tsx:78-83`).

#### O. Merge, Split and Organise (11)

- [x] **MGX-01** `v2` — Reorder the files to merge by dragging or with arrow buttons, and remove one (`src/components/FileOrder.tsx:24-51`).
- [x] **MGX-02** `v2` — Merging needs at least two PDFs and says so; the result is `merged.pdf` (`src/tools/MergePdf.tsx:25`, `:43-45`).
- [x] **SPL-01** `v2` — Split by page ranges, pre-filled with two halves (`src/tools/SplitPdf.tsx:33-35`, `:44-47`).
- [x] **SPL-02** `v2` — Split every N pages (`src/tools/SplitPdf.tsx:88-90`, `src/lib/ranges.ts:27-32`).
- [x] **SPL-03** `v2` — Split every page into its own file (`src/tools/SplitPdf.tsx:93`).
- [x] **SPL-04** `v2` — Range mistakes are explained, and output files are named by their pages (`src/lib/ranges.ts:10-20`, `src/tools/SplitPdf.tsx:53`).
- [x] **ORG-01** `v2` — A preview of every page, drawn as it scrolls into view (`src/components/PageThumb.tsx:14-29`, `src/tools/OrganisePdf.tsx:91-94`).
- [x] **ORG-02** `v2` — Move a page earlier or later (`src/tools/OrganisePdf.tsx:97`, `:109`).
- [x] **ORG-03** `v2` — Rotate a page left or right (`src/tools/OrganisePdf.tsx:100-105`).
- [x] **ORG-04** `v2` — Delete or keep a page, with a count of pages kept (`src/tools/OrganisePdf.tsx:78-80`, `:106-108`).
- [x] **ORG-05** `v2` — Reset, and save as `<name>-organised.pdf`, from a bar that stays in view (`src/tools/OrganisePdf.tsx:38`, `:77-88`).

#### P. Images to PDF and PDF to images (4)

- [x] **I2P-01** `v2` — Several JPG, PNG or WebP images into one PDF, in an order the person sets (`src/tools/ImagesToPdf.tsx:16-22`, `:49-52`).
- [x] **I2P-02** `v2` — Page size A4, US Letter or the size of each image, with portrait or landscape chosen to suit (`src/tools/ImagesToPdf.tsx:53-66`, `src/lib/pdf/ops.ts:76-95`).
- [x] **P2I-01** `v2` — Each page saved as PNG or JPG at 72, 150 or 300 dpi (`src/tools/PdfToImages.tsx:13-17`, `:69-85`).
- [x] **P2I-02** `v2` — Optional page selection by ranges, with "Page k of n" progress (`src/tools/PdfToImages.tsx:31-35`, `:40`, `:86-89`).

#### Q. Image tools (6)

- [x] **IMG-01** `v2` — Several images processed in one go (`src/tools/ImageTool.tsx:44-62`, `:81`).
- [x] **IMG-02** `v2` — WebP as input and output, and an output format chooser including "Keep the same" (`src/tools/ImageTool.tsx:17-21`, `:145-155`).
- [x] **IMG-03** `v2` — Quality control when converting and resizing (`src/tools/ImageTool.tsx:156-161`).
- [x] **IMG-04** `v2` — "Keep proportions" when resizing to an exact size (`src/tools/ImageTool.tsx:112-114`, `src/lib/image.ts:41-57`).
- [x] **IMG-05** `v2` — Target-size compression says when the target could not be reached, and explains that PNG is saved as WebP (`src/tools/ImageTool.tsx:47-48`, `:65-66`, `:163`).
- [x] **IMG-06** `v2` — Photographs keep their orientation, and transparent areas become white in JPG (`src/lib/image.ts:11`, `:22-26`).

#### R. Results and server tools (5)

- [x] **RES-01** `v2` — Several output files listed, each with its own "Save" (`src/components/Results.tsx:35-47`).
- [x] **RES-02** `v2` — "Save all as .zip", with duplicate names made unique (`src/components/Results.tsx:50-54`, `src/lib/download.ts:20-31`).
- [x] **SRV-01** `v2` — "Delete it now" removes the converted file from ConvertAPI (`src/tools/ServerConvert.tsx:40-44`, `:67-69`).
- [x] **SRV-02** `v2` — Each server tool states that the file is sent to ConvertAPI and is not stored by DocuMorph (`src/tools/ServerConvert.tsx:114-116`).
- [x] **SRV-03** `v2` — Files are identified by their first bytes in the browser and again on the server, so a renamed file is refused (`src/lib/files.ts:9-17`, `src/app/api/convert/route.ts:46-51`).

#### S. API, security and metadata (9)

- [x] **APX-01** `v2` — `POST /api/convert` accepts only the five listed conversions and their listed options (`src/app/api/convert/route.ts:40-58`).
- [x] **APX-02** `v2` — Daily limit per visitor, counted by a hashed IP address that changes each day, with an optional site-wide cap and optional shared storage (`src/app/api/convert/route.ts:23-27`, `:60-74`; `src/lib/rate-limit.ts:48-68`).
- [x] **APX-03** `v2` — `DELETE /api/convert?fileId=…` (`src/app/api/convert/route.ts:104-113`).
- [x] **APX-04** `v2` — Readable refusals: not set up (503), too large (413), wrong type (415), limit reached (429), conversion failed (502), took too long (504) (`src/app/api/convert/route.ts:31`, `:45`, `:50`, `:64-69`, `:86`, `:96`).
- [x] **HDR-01** `v2` — Security headers on every response (`next.config.ts:5-11`, `:15-17`).
- [x] **HDR-02** `v2` — No third-party requests at run time: fonts and the PDF worker are served from the site itself (`src/app/layout.tsx:8-9`, `src/lib/pdf/render.ts:10`, `scripts/copy-pdf-worker.mjs:8-14`).
- [x] **MET-01** `v2` — A title, description and canonical address for every tool page (`src/app/edit-pdf/page.tsx:8`, `src/app/[tool]/page.tsx:14-17`).
- [x] **MET-02** `v2` — Generated share image (1200 × 630) and large Twitter card (`src/app/opengraph-image.tsx:5-28`, `src/app/layout.tsx:19`).
- [x] **MET-03** `v2` — Page language `en-GB` and browser theme colours for light and dark (`src/app/layout.tsx:22-27`, `:33`).

### 2.3 Live on `main`, missing from `v2` (39 items)

The rebuild either restores each of these on the new design system or records the owner's confirmation that it
was dropped on purpose. The recommendation column is a proposal, not a decision; the decisions are listed in
section 9.

| Group | Items | What is missing | Recommendation |
| --- | --- | --- | --- |
| Feedback form and Formspree | FBK-01 to FBK-05, NAV-04, FLW-05, API-05, INT-03 (9) | The whole feedback route. The owner has **not** decided whether it returns. | Ask (D1). If restored: a short page and sheet, validated on the server, without the "escalation" pop-up |
| Donations and wallets | DON-01 to DON-06, API-06, INT-04 (8) | The donation dialog, twelve wallet addresses, the QR code | Ask (D2). If restored: QR drawn locally, coins without an address hidden |
| Vercel Blob uploads and large files | FLW-13, FLW-14, API-01, API-02, INT-02 (5) | Files up to 50 MB for the server tools. `v2` accepts 4 MB (`src/lib/files.ts:48`) | Ask (D3). The five server tools are the only ones affected; the nine device tools accept 100 MB |
| Upload progress | FLW-11, FLW-12 (2) | A percentage and a bar while a file uploads | **Restore** — on mobile data a spinner alone is not acceptable (section 13.7) |
| Terms and consent | LGL-01, LGL-03, FLW-08 (3) | Terms of Service, the dialogs, the consent tick box | Ask (D4). Recommended: a Terms page; no tick box for tools that never upload |
| Navigation on phones | NAV-03, NAV-05, NAV-06 (3) | Tool navigation in the header and any menu on a phone | **Restore** in a new form: section 13.3 |
| Footer credits | LGL-05, LGL-06, LGL-07 (3) | "Powered by ConvertAPI", the copyright line, LinkedIn and X links | Ask (D5); the credit may be a condition of the ConvertAPI plan |
| Image dimensions | RSZ-04, RSZ-05 (2) | Pixel dimensions before and after resizing | **Restore** — small, and useful |
| Defective on `main` | CMP-07, FLW-06, FLW-19, API-04 (4) | PDF "target size" that does nothing, the pretend upload animation, the preview that never shows, the open proxy mode | **Leave out**, with the owner's confirmation (D6) |

Also live on `main` and not in `v2`, found inside items marked `both`:

- **BMP and TIFF input** for compressing and resizing images (CMP-05, RSZ-03; `main:assets/js/scripts.js:420`, `:423-425`). Browsers cannot decode TIFF, so restoring it means sending those files to the server (D7).
- **A size limit in megabytes** for target-size compression (CMP-06): `v2` takes kilobytes only.
- **The "Donate" button on the success screen** (FLW-17; `main:index.html:522-528`), which follows D2.
- **The local-storage counter `documorph_usage`** (FLW-20), replaced in `v2` by the server limit; nothing reads it any longer.
- **The `keywords` meta tag** (`main:index.html:23-26`), which search engines ignore; not restored.

### 2.4 Present in both, changed in `v2` (to be confirmed with the checklist)

| Item | `main` | `v2` |
| --- | --- | --- |
| NAV-01, CNV-01 | One page; a drop-down chooses the conversion | A list of tools; one address per tool |
| CNV-06, CNV-07, CMP-05, RSZ-01 to RSZ-03, MRG-01 | Processed by ConvertAPI | Processed on the device; nothing is uploaded |
| CMP-03 | Slider 1–9 with words | Percentage slider for images; three named presets for PDFs |
| RSZ-02 | 100, 75, 50, 25 % | Any value from 5 to 200 % in steps of 5 |
| FLW-04 | 50 MB everywhere | 100 MB on the device, 4 MB to the server |
| FLW-16 | Browser alert boxes | Inline message |
| FLW-20 | Five a day, in local storage, all tools | Ten a day by default, on the server, server tools only |
| API-03 | JSON body carrying a file URL and any parameters | Multipart body carrying the file and a listed tool |
| LGL-02 | Dialog; text contradicted by the code | Page; text matches what the code does |
| LGL-04 | Terms, Privacy, Feedback, Donate | Privacy, Source code, Built by |

---

## 3. Current stack and recommendation

### 3.1 What exists on `v2` (the base)

| Layer | Today (`package.json:14-34`) | Assessment |
| --- | --- | --- |
| Framework | Next.js `^16.4.6` (App Router, Turbopack), React `^19.3.0` | Keep. Its use of Next APIs was checked against `node_modules/next/dist/docs`, as `AGENTS.md:5` requires: `params` is awaited as a promise (`src/app/[tool]/page.tsx:14`, `:19-20`), and the theme script follows the documented inline-script method (`01-app/02-guides/preventing-flash-before-hydration.md`) |
| Language | TypeScript `^6.0.3`, `strict` (`tsconfig.json:7`) | Keep; add `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` |
| Styling | Tailwind CSS `^4.3.3`, loaded through a Turbopack loader rule (`next.config.ts:18-25`) | Keep Tailwind. The Next documentation describes the `@tailwindcss/postcss` route (`01-app/01-getting-started/11-css.md:28-52`); the loader rule builds, but the documented route will be preferred unless a measured reason says otherwise |
| Fonts | Geist and Geist Mono through `next/font/google`, served from the site (`src/app/layout.tsx:2`, `:8-9`) | Keep |
| Icons | `lucide-react` `^0.468.0` | Keep the set; upgrade (latest is 1.75.0) |
| PDF writing | `pdf-lib` `^1.17.1`, `@pdf-lib/fontkit` `^1.1.1` | Works and is tested. `pdf-lib` has had no release since 2021; the maintained fork `@cantoo/pdf-lib` (2.11.1) is to be evaluated (D12) |
| PDF rendering | `pdfjs-dist` `^6.5.438`, worker copied into `public/` at install (`scripts/copy-pdf-worker.mjs`) | Keep; the copied worker is the cause of the lint failure (section 4.1) |
| Zip | `jszip` `^3.10.2`, loaded on demand (`src/lib/download.ts:21`) | Keep |
| Server | One route handler, `src/app/api/convert/route.ts`, Node runtime, 60 s | Keep with changes (section 12.6) |
| Tests | Vitest `^5.1.0`, 26 tests in two files | Keep and extend |
| Lint | ESLint `^9.39.5`, `eslint-config-next` `^16.4.6` (`eslint.config.mjs`) | Keep; fix the failure at its cause; add `--max-warnings 0` |
| Not present | zod, Prettier, Playwright, continuous integration, `.env.example`, `LICENSE`, `engines` | Add |

### 3.2 Static or framework?

Settled. The owner has chosen `v2`, which is a Next.js application, and the audit agrees with the choice: the
product now has sixteen addresses that each need their own title and description, a server route that needs
typed validation and tests, and a PDF editor that needs a component model. Staying with hand-written static
files is no longer an option under consideration.

### 3.3 Target versions

Checked with `npm view <pkg> version` on 18 November 2026.

| Package | In `v2` | Target | Note |
| --- | --- | --- | --- |
| Node.js | not declared | 24 LTS on Vercel; `engines: ">=22.13"` | The audit machine runs 22.23.5 |
| `next` | `^16.4.6` | 16.4.6 | Current |
| `react`, `react-dom` | `^19.3.0` | 19.3.1 | |
| `typescript` | `^6.0.3` | **6.0.3** | 7.0.2 exists, but `typescript-eslint` 8.73.0 declares `typescript >=4.8.4 <6.1.0`; moving to 7 would mean linting outside the supported range |
| `tailwindcss` | `^4.3.3` | 4.3.5 | With `@tailwindcss/postcss` 4.3.5 |
| `lucide-react` | `^0.468.0` | 1.75.0 | Major upgrade; icon names to be re-checked |
| `pdfjs-dist` | `^6.5.438` | Latest 6.x at the time of work | |
| `pdf-lib` | `^1.17.1` | 1.17.1, or `@cantoo/pdf-lib` 2.11.1 if the evaluation passes | D12 |
| `zod` | — | 4.6.7 | Request and environment validation |
| `eslint` | `^9.39.5` | **9.39.5** | 10.15.0 exists, but `eslint-plugin-jsx-a11y` 6.10.2 (bundled by `eslint-config-next`) supports ESLint up to 9 |
| `prettier` | — | 3.10.1 | |
| `vitest` | `^5.1.0` | 5.1.1 | |
| `@playwright/test`, `@axe-core/playwright` | — | 1.65.1, latest | End-to-end tests at phone and desktop sizes; accessibility checks |
| `@upstash/redis` | — (plain `fetch`, `src/lib/rate-limit.ts:31-46`) | Not added | The existing `fetch` call is sufficient and has no dependency |

Only if the owner restores the corresponding `main` features: `@vercel/blob` 2.9.0 (D3) and `qrcode` 1.5.4
(D2). `busboy`, Font Awesome, the esm.sh import and the hot-linked coin logos of `main` are not brought back in
any case.

### 3.4 Keep, upgrade, replace

| Item | Decision | Why |
| --- | --- | --- |
| The `v2` application as a whole | Keep as the base | Owner's decision; the engine is sound and tested (section 12) |
| Vercel hosting | Keep | Works |
| ConvertAPI for Office formats and PDF compression | Keep | No browser-side equivalent |
| Browser-side PDF and image work | Keep | The product's main advantage: nine of fourteen tools never upload |
| The `.btn` and `.field` CSS classes (`src/app/globals.css:68-115`) | Replace with typed components | One Button and one Field, with sizes fit for touch |
| The editor's pointer handling | Redo | It blocks scrolling and zooming on a phone (section 12.5) |
| Native `confirm()` (`src/tools/editor/PdfEditor.tsx:91`) | Replace with the project's dialog | Consistent, translatable, testable |
| Vercel Blob, Formspree, wallets | Only if the owner says so | D1 to D3 |

### 3.5 The live site (`main`) for reference

One static `index.html` (1,013 lines), one stylesheet (1,668 lines), one script (1,196 lines) and five
CommonJS functions in `api/` (656 lines), with `@vercel/blob` and `busboy` as dependencies
(`main:package.json:12-13`). No build, types, lint or tests. It is not the base and none of its code is
carried forward; it is the record of what is live, used for the `main` and `both` items of section 2.

---

## 4. Baseline results

### 4.1 `v2` — the baseline for the rebuild

Run on 18 November 2026 in `/home/user/DocuMorph` on `rebuild/production` (= `origin/v2`), Node 22.23.5, npm
10.9.9. Nothing was fixed. No `.env` file was created or read, and no environment variable was set.

| Check | Command | Result |
| --- | --- | --- |
| Install | `npm ci` | **Pass.** 413 packages added. The `postinstall` script copied the PDF worker into `public/`. npm reported 17 vulnerabilities (6 moderate, 11 high) |
| Production build | `npm run build` (`next build`) | **Pass**, no warnings. Compiled in 19.0 s; TypeScript in 5.3 s; 21 static pages generated. No environment variable was needed |
| Lint | `npm run lint` (`eslint`) | **Fail, exit 1: 1,574 problems — 5 errors, 1,569 warnings**, all in one file |
| Type check | `npm run typecheck` (`tsc --noEmit -p .`) | **Pass**, 0 errors |
| Unit tests | `npm test` (`vitest run`) | **Pass: 26 tests in 2 files**, 790 ms |
| Audit | `npm audit`; `npm audit --omit=dev` | 17 (6 moderate, 11 high) with development packages; **0** in the packages that ship |

**Build output.** Static: `/`, `/_not-found`, `/compress-image`, `/convert-image`, `/edit-pdf`, `/icon.svg`,
`/images-to-pdf`, `/merge-pdf`, `/opengraph-image`, `/organise-pdf`, `/pdf-to-images`, `/privacy`,
`/resize-image`, `/split-pdf`. Pre-rendered from `generateStaticParams`: `/word-to-pdf`, `/pdf-to-word`,
`/excel-to-pdf`, `/pdf-to-excel`, `/compress-pdf`. Rendered on demand: `/api/convert`. The build needs no
environment variable; at run time the server tools answer "not set up" until `CONVERTAPI_SECRET` exists
(`src/app/api/convert/route.ts:30-31`).

**The lint failure.** Every one of the 1,574 findings is in `public/pdf.worker.min.mjs`, the minified PDF
worker that `scripts/copy-pdf-worker.mjs:14` copies out of `node_modules` at install. The five errors are all
`@typescript-eslint/no-this-alias`; the warnings are mostly `@typescript-eslint/no-unused-expressions`. The file
is ignored by Git (`.gitignore:44`) but not by ESLint (`eslint.config.mjs:8-15`). The project's own source has
no lint finding. This is recorded, not fixed; the fix belongs to phase 0 (section 8.1).

**Sizes measured from the build output** (uncompressed bytes on disk; compressed transfer sizes were not
measured):

| Page | Scripts referenced by the HTML | Total |
| --- | --- | --- |
| `/` | 8 | 582,242 bytes |
| `/edit-pdf` | 12, one of them 1,092,734 bytes | 1,754,617 bytes |

Also: one stylesheet of 29,455 bytes; seven font files totalling 108,024 bytes, two of them preloaded (23,108
and 29,288 bytes); the PDF worker, 1,271,915 bytes, fetched when a PDF is first opened; the bundled Noto Sans,
621,572 bytes, fetched only when a saved text needs it (`src/tools/editor/PdfEditor.tsx:210`).

**Working tree afterwards.** `git status --porcelain` is empty apart from this file. `node_modules/`, `.next/`,
`next-env.d.ts`, `tsconfig.tsbuildinfo` and `public/pdf.worker.min.mjs` are all ignored (`.gitignore:4`, `:17`,
`:41`, `:40`, `:44`). `AGENTS.md` was not altered by the build.

**Lighthouse was not re-run for this revision.** An attempt to serve the build locally and run Lighthouse was
stopped by the audit environment's permission controls. The figures below come from the earlier audit of the
same commit (mobile, Lighthouse 13.6.0, headless Chromium, `next start` on the audit machine) and are
**indicative only**: local serving has no network latency.

| Page | Performance | Accessibility | Best practices | SEO | Main failing audits |
| --- | --- | --- | --- | --- | --- |
| `/` | 96 | 96 | 100 | 100 | Colour contrast; unused JavaScript; TBT 220 ms |
| `/edit-pdf` | 78 | 96 | 100 | 100 | TBT 1,060 ms; 1.5 s script execution; colour contrast |
| `/word-to-pdf` | 100 | 96 | 100 | 100 | Colour contrast |

The other twelve pages have never been measured. A Lighthouse run cannot open a PDF, so the editor's real
weight on a phone (after a file is chosen) has not been measured by anyone; section 14 (h) requires it.

**Not exercised.** No conversion was sent to ConvertAPI, and nothing was run on a real phone. The mobile
findings in sections 5 and 13 come from reading the code and are marked where they need confirmation on a
device.

### 4.2 `main` — the live site's former baseline, for reference

Recorded in the first version of this plan with the same Node and npm; not re-run.

| Check | Result on `main` |
| --- | --- |
| `npm ci` | **Failed, exit 1**: `busboy@1.6.0` and `streamsearch@1.1.0` missing from the lockfile (`main:package.json:13`) |
| Build, lint, type check, tests | None exist: no build script, no linter, plain JavaScript, no tests |
| `node --check` on the six `.js` files | All pass |
| `npm audit` | 3 vulnerabilities (1 moderate, 2 high), all through `@vercel/blob` 1.1.1 |
| Lighthouse, mobile, `/index.html`, indicative only | Performance 98, Accessibility 93, Best practices 96, SEO 100 — with the Font Awesome stylesheet and coin logos blocked by the audit network, so real performance is worse |

Behaviour confirmed on `main` in a headless browser at that time: a failed conversion raises three alert boxes
in a row; the result preview never appears; Escape closes neither a dialog nor a drop-down; the daily limit is
lifted by clearing local storage; at 360 px wide, paragraph text renders at 10.88 px, the primary button label
at 11.84 px, and the menu button is 30 × 20 px.

---

## 5. Problems found

Severity: **Critical** (exposes the owner or users to real harm), **High**, **Medium**, **Low**. Sections 5.1 to
5.8 are problems in `v2`, the base. Section 5.9 lists the problems of `main` and says which of them `v2` has
already solved. No Critical problem was found in `v2`.

### 5.1 Mobile (`v2`)

These come first because they decide whether the product works for most of its customers. They were found by
reading the code; items marked † must be confirmed on real phones in phase 4.

| ID | Location | Problem | Severity |
| --- | --- | --- | --- |
| MOB-01 | `src/tools/editor/EditorPage.tsx:130`; `src/tools/editor/PdfEditor.tsx:447` | Every page of the editor carries `touch-none` over its whole surface, and each page fills the width of the screen. A finger on a page can therefore neither scroll the document nor pinch to zoom, whichever tool is chosen — including Select. On a phone the document can be scrolled only from the thin strips between pages. | High |
| MOB-02 | `src/tools/editor/PdfEditor.tsx:447-448`; `src/tools/editor/EditorPage.tsx:170` | There is no zoom. The page is scaled to the container, so an A4 page (595 pt) on a 360 px phone is shown at about 0.55 scale: 14 pt text is drawn at roughly 8 px and the text box being typed in has the same size. Below 16 px, iOS Safari zooms the whole page when the box takes focus. † | High |
| MOB-03 | `src/tools/editor/PdfEditor.tsx:289-371` | The toolbar is at the top, out of thumb reach, and sticks below the header. It holds twelve buttons that wrap on to further rows, a second row of text options and a hint line; on a 360 px screen the sticky area is estimated (from the class values, not measured) at well over 150 px of a screen that the on-screen keyboard then halves. | High |
| MOB-04 | `src/tools/editor/PdfEditor.tsx:299-301`, `:306-320`; `src/tools/OrganisePdf.tsx:122`; `src/components/FileOrder.tsx:43-49`; `src/components/Header.tsx:27`; `src/tools/editor/SignaturePad.tsx:135` | Tap targets are below 44 px throughout: editor tool buttons about 36 × 28 px (16 px icon, labels hidden below 1024 px), Organise page controls 28 px with five to a thumbnail, file-order buttons 32 px, theme switch 36 px, dialog close 32 px. Sizes are computed from the classes. | High |
| MOB-05 | `src/tools/editor/EditorPage.tsx:150`, `:214`, `:117-118` | The handle for moving text is 16 × 20 px and the resize handle 12 × 12 px. Resizing an image freely requires holding Shift, which a phone does not have. | High |
| MOB-06 | `src/app/globals.css:108`, `:76` | Every input and select is 14 px (`.field`), so iOS Safari zooms the page on focus †; buttons are 14 px; hints are 12 px (`src/components/Dropzone.tsx:85`, `src/tools/ServerConvert.tsx:114`, `src/tools/editor/PdfEditor.tsx:370`). The brief for this rebuild requires 16 px body text. | High |
| MOB-07 | `src/components/Header.tsx:41-46` | Below 640 px the header has only the logo and the theme switch. There is no way to move from one tool to another except back through the home page. | Medium |
| MOB-08 | `src/tools/ServerConvert.tsx:25-29`, `:106` | Server conversions show a spinner only: no upload progress, no way to cancel, no time limit in the browser, no message when the connection drops, and no retry that keeps the chosen file. | High |
| MOB-09 | `src/tools/editor/EditorPage.tsx:131-133`, `:189-190`; `src/tools/editor/SignaturePad.tsx:163-180` | No `pointercancel` handling. When the system takes over a touch (a notification, a gesture, a second finger) a drag or a signature stroke is left unfinished and the "drawing" flag stays set. | Medium |
| MOB-10 | `src/tools/editor/SignaturePad.tsx:83-95`, `:162` | The signature canvas is sized once. Turning the phone changes its displayed width but not its drawing size, so later strokes land away from the finger. The pad is 176 px tall and the lines are not smoothed. † | Medium |
| MOB-11 | `src/tools/editor/SignaturePad.tsx:115`, `:203`; `src/tools/editor/types.ts:16-20` | The typed signature asks for 'Segoe Script', 'Brush Script MT' or 'Snell Roundhand', and the editor measures text with Helvetica, Times New Roman and Courier New. Android phones do not normally carry these faces †, so a typed signature falls back to whatever "cursive" means on the device, and text measured on screen may not match the width saved in the PDF. | Medium |
| MOB-12 | `src/lib/files.ts:46`; `src/lib/download.ts:35`; `src/lib/pdf/render.ts:19`; `src/tools/editor/PdfEditor.tsx:84` | Files of up to 100 MB are read whole into memory, copied for the renderer, parsed again by the writer, and in the editor read a second time from disk. Nothing adapts the limit to a phone, where the browser is likely to discard the tab. † | High |
| MOB-13 | `src/lib/pdf/render.ts:47-50`; `src/lib/image.ts:17-20`; `src/tools/editor/EditorPage.tsx:42` | Canvases have no pixel ceiling: a large page at 300 dpi or a high-resolution photograph can exceed what a mobile browser will allocate, and the failure is reported only as "could not create the image". Editor pages, once drawn, are never released. † | Medium |
| MOB-14 | `src/lib/files.ts:5-17`; `src/components/Dropzone.tsx:40`, `:52` | The image tools know JPG, PNG and WebP only. iPhone cameras save HEIC by default; whether the picker hands the site a JPEG or a HEIC file depends on the `accept` value and the iOS version †. A HEIC file is refused as "not a JPG, PNG, WebP file" with no advice. | Medium |
| MOB-15 | `src/components/Dropzone.tsx:40` | For Office files `accept` lists extensions only (`.docx,.doc`). Some Android file pickers filter by MIME type and may show these files greyed out †. No picker offers the camera for "Images to PDF", the commonest phone use (photograph pages, make a PDF). | Medium |
| MOB-16 | `src/components/FileOrder.tsx:24-33`, `:36` | Reordering by dragging uses HTML drag-and-drop events, which are unreliable under touch †; on a phone the 32 px arrow buttons are the only dependable way, while the drag handle is still shown. | Medium |
| MOB-17 | `src/lib/download.ts:8-18`; `src/tools/ServerConvert.tsx:63` | Saving relies on a temporary link with a `download` attribute. That works in Safari and Chrome but often fails inside in-app browsers (links opened from chat and social apps) †, and there is no "Share" route to Files, WhatsApp or e-mail. The server tools' link is cross-origin, where `download` is ignored, so the file opens in a new tab instead of saving. | High |
| MOB-18 | `src/tools/editor/PdfEditor.tsx:256-261` | The only protection against losing work is a `beforeunload` warning, which mobile browsers frequently do not show †. Edits are held in memory only; switching apps to copy a detail can lose them if the tab is discarded. | Medium |
| MOB-19 | `src/app/layout.tsx:22-27`; `src/components/Header.tsx:35`; `src/tools/OrganisePdf.tsx:77` | The viewport is the framework default (`width=device-width, initial-scale=1`, confirmed in the built HTML) without `viewport-fit=cover`, and no rule uses `env(safe-area-inset-*)`. Nothing breaks today because nothing is fixed to the bottom; the bottom bars this plan introduces need both. | Low |
| MOB-20 | `src/tools/SplitPdf.tsx:83`, `:89`; `src/tools/PdfToImages.tsx:88`; `src/tools/ImageTool.tsx:106-110`, `:138`; `src/tools/editor/SignaturePad.tsx:202` | Input attributes are incomplete: no `autocomplete`, `enterkeyhint`, `autocapitalize` or `pattern` anywhere; page ranges use the full text keyboard with autocorrection; the name field for a typed signature has no `autocomplete="name"` and takes focus automatically, which raises the keyboard before the person has seen the dialog. | Medium |
| MOB-21 | `src/tools/ImageTool.tsx:97`, `:113`, `:130`; `src/tools/SplitPdf.tsx:79`, `:88`, `:93` | Radio buttons and tick boxes are the browser's small native controls with tap rows about 20 px tall. | Medium |

### 5.2 Security and privacy (`v2`)

| ID | Location | Problem | Severity |
| --- | --- | --- | --- |
| SEC-V1 | `next.config.ts:5-11` | No Content-Security-Policy. The other headers are present. The inline theme script (`src/app/layout.tsx:35`) and Next's own inline scripts mean a strict policy needs nonces or hashes; the Next documentation notes that nonces require dynamic rendering (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md:38`), which would end static pre-rendering. The approach is a design task for phase 6, not a one-line header. | High |
| SEC-V2 | `src/app/api/convert/route.ts:81`, `:109` | The ConvertAPI secret travels in the query string of the outgoing request, where intermediaries may log it. It should travel in a header if ConvertAPI's current API allows (to be confirmed against its documentation). | Medium |
| SEC-V3 | `src/app/api/convert/route.ts:18-19`; `src/lib/rate-limit.ts:62` | The limits are read with `Number(process.env…)` and never validated. A mistyped value yields `NaN`, and `count > NaN` is always false, so the daily limit silently stops applying. | Medium |
| SEC-V4 | `src/app/api/convert/route.ts:78`, `:100`; `src/tools/ServerConvert.tsx:74-77` | The converted file is left on ConvertAPI's storage, reachable by its URL for up to three hours, unless the person presses "Delete it now". The privacy page says so honestly (`src/app/privacy/page.tsx:29-30`), but deletion should not depend on a button most people will not press. | Medium |
| SEC-V5 | `src/lib/rate-limit.ts:5-8`, `:48-52` | Without the two Upstash variables the counts are kept in each server instance's memory, so the limit is approximate. The code says so; the owner needs to decide (section 9). | Medium |
| SEC-V6 | `src/app/api/convert/route.ts:104-113` | `DELETE /api/convert` is not rate-limited and is not tied to the visitor who made the file. The identifier is hard to guess, so the practical risk is unmetered calls to ConvertAPI under the owner's secret. | Low |
| SEC-V7 | `src/app/api/convert/route.ts:24` | The visitor's address is taken from the first entry of `x-forwarded-for`, which is trustworthy on Vercel but can be forged on other hosts; visitors with no address all share the key "unknown". | Low |
| SEC-V8 | `src/lib/files.ts:14` | Any ZIP file passes as an Office document if its name ends in `.docx` or `.xlsx`. ConvertAPI will refuse it, but only after one of the day's conversions has been spent. | Low |
| SEC-V9 | `src/app/api/convert/route.ts:40-58` | Request fields are validated by hand, with `String()` coercions; there is no schema and no validated environment module. Correct today, but against the standards in section 11 and untested. | Low |
| SEC-V10 | `README.md:49`; `.gitignore:34` | The README points to `.env.example`, which is not in the repository; the ignore rule `.env*` would also keep it out. | Low |

No secret-looking value was found in tracked source. No `.env` file exists in the working tree and none was
created or opened. `npm audit --omit=dev` reports nothing in the packages that ship.

### 5.3 Bugs (`v2`)

| ID | Location | Problem | Severity |
| --- | --- | --- | --- |
| BUG-V1 | `eslint.config.mjs:8-15`; `scripts/copy-pdf-worker.mjs:14` | `npm run lint` fails with 5 errors and 1,569 warnings because the copied PDF worker is linted (section 4.1). | High |
| BUG-V2 | `src/app/api/convert/route.ts:62`, `:84-97` | A conversion is counted against the visitor's daily limit before ConvertAPI is called and is never given back, so a failed or timed-out conversion still uses one of the day's allowance. | Medium |
| BUG-V3 | `src/tools/ServerConvert.tsx:63` | The download link for a server conversion is on another origin with `target="_blank"`; browsers ignore `download` there, so PDFs open in a tab instead of saving and the file name is not applied. (The same fault as `main`.) | Medium |
| BUG-V4 | `src/components/Dropzone.tsx:46` | Where one file is expected, extra files that were dropped or picked are discarded without a word. | Low |
| BUG-V5 | `src/tools/editor/PdfEditor.tsx:84`; `src/components/usePdf.ts:21-24` | The editor reads the chosen file from disk twice. | Medium |
| BUG-V6 | `src/tools/SplitPdf.tsx:61`, `:101` | "Choose another file" clears the file but keeps its bytes in memory until another is opened. | Low |
| BUG-V7 | `src/tools/editor/PdfEditor.tsx:92`, `:163`, `:384` | Preview addresses for placed images are released only when the PDF is closed; an image chosen and then abandoned is never released. | Low |
| BUG-V8 | `src/lib/tools.ts:31`; `src/components/ToolShell.tsx:7`, `:15` | `toolBySlug` asserts that a tool exists. An unknown name would crash the page instead of showing "not found". Unreachable with today's fixed routes. | Low |
| BUG-V9 | `src/tools/ImageTool.tsx:97`, `:130`; `src/tools/SplitPdf.tsx:79`, `:88`, `:93` | Radio buttons have no shared `name`, so they are not a group: arrow keys do not move between them and assistive technology does not announce "1 of 3". | Medium |
| BUG-V10 | `src/app/opengraph-image.tsx:14` | The share image draws an empty teal square where the logo should be, and repeats colour values instead of using the tokens. | Low |

Not verifiable without live ConvertAPI calls, which this audit was not permitted to make: that each of the six
routes in `src/lib/server-tools.ts:28-64` and the `Preset` values are accepted, and that
`DELETE /d/<fileId>` behaves as `src/app/api/convert/route.ts:109-111` expects.

### 5.4 Structure and code quality (`v2`)

| ID | Location | Problem | Severity |
| --- | --- | --- | --- |
| QLT-V1 | 37 lines, for example `src/tools/ServerConvert.tsx:13`, `:27`, `:32`; `src/tools/editor/SignaturePad.tsx:20`, `:89`, `:166`; `src/lib/tools.ts:31` | Non-null `!` assertions outside the tests (ten in `SignaturePad.tsx` alone). | Medium |
| QLT-V2 | `src/tools/editor/EditorPage.tsx:205` | One `eslint-disable` comment. | Low |
| QLT-V3 | `src/tools/editor/PdfEditor.tsx:45-492` | One component of about 450 lines holds document state, history, placement, styling, saving, keyboard handling, the form panel and the layout. | Medium |
| QLT-V4 | `src/components/Results.tsx:78-83`; `src/components/usePdf.ts:7`; `src/components/FileOrder.tsx:59-60` | Concerns are mixed: an error-explaining helper and an identifier generator live in component files, a hook lives in `components/`, and a hook imports from a component. | Low |
| QLT-V5 | `src/app/globals.css:68-115` | Buttons and fields are global CSS classes with per-use overrides (`btn btn-quiet size-8 p-0`), so there is no single Button whose sizes can be guaranteed. | Medium |
| QLT-V6 | `package.json:10`; `tsconfig.json:7` | `eslint` runs without `--max-warnings 0`; `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are off. | Medium |
| QLT-V7 | repository root | No formatter, no continuous integration, no `engines`, no `LICENSE`, no `error.tsx` or `not-found.tsx`. | Medium |
| QLT-V8 | `src/lib/__tests__/` | Tests cover the pure helpers only. Nothing tests the route handler, a component, or a flow in a browser. | High |
| QLT-V9 | `src/tools/editor/PdfEditor.tsx:91` | A native `confirm()` box. | Low |
| QLT-V10 | `src/app/[tool]/page.tsx`; `src/app/*/page.tsx` | Nine near-identical 16-line page files beside one dynamic route for the other five; two ways of doing the same thing. | Low |

### 5.5 Performance (`v2`)

| ID | Location | Problem | Severity |
| --- | --- | --- | --- |
| PERF-V1 | `src/lib/pdf/ops.ts:4-17`; build output | `pdf-lib` and `fontkit` are imported statically by every PDF tool, so `/edit-pdf` references a 1,092,734-byte script before any file is chosen (section 4.1). Only `pdf.js` is loaded on demand (`src/lib/pdf/render.ts:8-13`). | High |
| PERF-V2 | build output | The home page references 582,242 bytes of script (uncompressed) to show a list of links. | Medium |
| PERF-V3 | `public/fonts/NotoSans-Regular.ttf` | The fallback font is a 621,572-byte uncompressed TTF. Fetched only when needed, but on mobile data it is the largest single download after the worker. | Low |
| PERF-V4 | `src/components/Header.tsx:35`; `src/tools/OrganisePdf.tsx:77`; `src/tools/editor/PdfEditor.tsx:289` | `backdrop-blur` on three sticky bars, repainted on every scroll frame on low-end phones. | Low |
| PERF-V5 | `src/tools/editor/EditorPage.tsx:141`; `src/tools/editor/types.ts:40-46` | Every text item is re-measured on every render of its page, including on each pointer move during a drag. | Low |

### 5.6 Accessibility (`v2`)

| ID | Location | Problem | Severity |
| --- | --- | --- | --- |
| A11Y-V1 | `src/app/globals.css:11`, `:26` | `--subtle` text fails contrast: `#7b8494` is 3.52:1 on the page and 3.77:1 on white; in dark mode `#758091` is 4.33:1 on a surface. It is used for hints, sizes and group headings. | High |
| A11Y-V2 | `src/app/globals.css:8`, `:23`, `:105` | Input and button borders use `--line`: 1.30:1 on white and 1.34:1 in dark mode, far below the 3:1 required for the boundary of a control. | Medium |
| A11Y-V3 | `src/components/Dropzone.tsx:63-91` | The file input is visually hidden inside its label, so a keyboard user lands on an invisible control and the drop zone shows no focus ring. | High |
| A11Y-V4 | `src/app/globals.css:111-114` | Fields remove the focus outline and change only the 1 px border colour. | Medium |
| A11Y-V5 | `src/tools/editor/EditorPage.tsx:68-83`, `:146-148`, `:211-212` | Placing, moving and resizing need a pointer; the handles are taken out of the tab order. There is no keyboard route to add or move anything. | Medium |
| A11Y-V6 | `src/tools/editor/SignaturePad.tsx:132-155` | The dialog has no accessible name, and the tabs have `role="tab"` without panels, `aria-controls` or arrow-key movement. | Medium |
| A11Y-V7 | `src/app/globals.css` (whole file); `src/components/PageThumb.tsx:37` | No `prefers-reduced-motion` handling for the pulse, spin and transitions. | Medium |
| A11Y-V8 | `src/tools/ServerConvert.tsx:106`; `src/tools/PdfToImages.tsx:40`, `:94` | Progress is text inside a button; nothing announces "working" or "page 3 of 12" to a screen reader. | Medium |
| A11Y-V9 | `src/tools/editor/PdfEditor.tsx:418` | Form fields are labelled with the PDF's internal field names, which are often meaningless ("Text1"). | Low |

### 5.7 Design (`v2`)

| ID | Location | Problem | Severity |
| --- | --- | --- | --- |
| DES-V1 | `src/app/globals.css:35-50` | The design system is twelve colours and two font variables. There is no type scale, spacing scale, radius scale, shadow scale or motion rule. | High |
| DES-V2 | `src/app/page.tsx:44-63`, `:72-91` | The home page is an introduction with a pill badge and two buttons above a grid of identical rounded cards with tinted icon tiles — close to the stock layout section 11 rules out. On a phone the tools start below the first screen. | Medium |
| DES-V3 | `src/app/globals.css:74`; `src/app/page.tsx:45`, `:77`, `:79`; `src/components/ToolShell.tsx:27`; `src/tools/OrganisePdf.tsx:122` | Six corner radii in use (9.6 px, 6 px, 8 px, 12 px, 16 px and full pills). | Low |
| DES-V4 | `src/components/Header.tsx:35` | A translucent, blurred header: the glass effect section 11 rules out, in a mild form. | Low |
| DES-V5 | `src/tools/*.tsx` | The layout was drawn for a desktop and narrowed: options sit above the action, actions are at the top of long pages, and nothing is placed for a thumb. Section 13 replaces this. | High |
| DES-V6 | `src/tools/editor/PdfEditor.tsx:299-301` | Below 1024 px the seven editor tools are icons with no labels; "Cover" (an eraser) and "Box" (a square) are not self-explanatory. | Medium |

### 5.8 Search, sharing and legal content (`v2`)

| ID | Location | Problem | Severity |
| --- | --- | --- | --- |
| SEO-V1 | `src/app/` | No `sitemap`, `robots`, web manifest, Apple touch icon or raster favicon. | Medium |
| SEO-V2 | `src/app/layout.tsx:11-20`; `src/app/privacy/page.tsx:4-7` | `/` and `/privacy` have no canonical address; every page shares one share image. | Low |
| SEO-V3 | `src/lib/tools.ts:35` | The public address defaults to `https://documorph-blue.vercel.app` in code when `NEXT_PUBLIC_SITE_URL` is absent. | Low |
| LEG-V1 | `src/app/privacy/page.tsx:9-48` | The privacy page is accurate for `v2` but has no date and no contact, and there are no Terms of Service. | Medium |
| LEG-V2 | `src/tools/ServerConvert.tsx:114-116` | Server tools tell the person where the file goes, but only in 12 px text beneath the action. | Low |

### 5.9 Problems of `main`, and what `v2` has done about them

The first version of this plan listed 97 problems on `main`, with locations. Their identifiers are kept here so
that nothing is lost, with a few words on each where the status needs them. The first version was written
against `main`, before this branch was re-based on `v2`; its longer descriptions are not repeated here.

| Status in `v2` | `main` problems | Note |
| --- | --- | --- |
| **Solved by `v2`** | SEC-01 (open proxy), SEC-04 (limit in local storage only), SEC-05 (unpinned esm.sh import), SEC-06 (arbitrary file URLs), SEC-09 (documents logged), SEC-11 (CDN without integrity), SEC-16 (stack trace returned) | Allow-list and limit at `src/app/api/convert/route.ts:40-74`; no third-party script at all |
| **Solved by `v2`** | BUG-01 (three alerts), BUG-03 (chooser out of step), BUG-04 (lockfile), BUG-05 (function settings ignored), BUG-06 (pretend upload), BUG-10 (stray timer), BUG-11 (Enter re-opens list), BUG-13 (error always "Error"), BUG-18 (no-change resize spends allowance), BUG-20 to BUG-22 | `npm ci` passes; native selects; JSON errors at `src/app/api/convert/route.ts:21` |
| **Solved by `v2`** | QLT-01, QLT-03, QLT-04, QLT-05, QLT-06, QLT-08, QLT-10 to QLT-15; PERF-01, PERF-02, PERF-04, PERF-05, PERF-06; A11Y-01, A11Y-02, A11Y-03, A11Y-08, A11Y-12 to A11Y-15, A11Y-18; DES-01, DES-03, DES-04, DES-05, DES-07 to DES-12; SEO-03, SEO-04; LEG-01 | Typed modules, self-hosted fonts, native form controls, skip link, `en-GB`, the owner's own logo, an accurate privacy page |
| **Solved by removal; returns only if the feature is restored** | SEC-02, SEC-03, SEC-13, BUG-02, BUG-12 (Blob uploads, D3); SEC-08, BUG-14 (feedback, D1); SEC-12, SEC-15, BUG-15, BUG-16, QLT-09 (donations, D2); BUG-07, BUG-09, BUG-17, A11Y-04, LEG-03 (preview, PDF target size, TIFF, consent) | If restored, each is rebuilt to the standards of section 11, not copied |
| **Partly solved** | SEC-07 (headers present, no CSP → SEC-V1); SEC-14 (all env files ignored, but so is the example → SEC-V10); QLT-02 (types, lint and tests exist; lint fails, no CI → BUG-V1, QLT-V7); PERF-03 (blur remains on bars → PERF-V4); A11Y-05 (native dialog, unnamed → A11Y-V6); A11Y-06 (one `confirm()` → QLT-V9); A11Y-07 (→ A11Y-V4); A11Y-09 (→ A11Y-V1); A11Y-10 (12 and 14 px text → MOB-06); A11Y-17 (→ A11Y-V8); DES-02 (→ DES-V4); DES-06 (→ DES-V3); SEO-01 (canonical on tool pages only → SEO-V2) | Carried into sections 5.1 to 5.8 under the identifiers shown |
| **Still present** | SEC-10 (secret in query string → SEC-V2); BUG-08 (cross-origin download → BUG-V3); BUG-19 (extra files dropped silently → BUG-V4); QLT-07 (an `eslint-disable` → QLT-V2); QLT-16 (no `LICENSE` → QLT-V7); A11Y-11 (small targets → MOB-04); A11Y-16 (no reduced motion → A11Y-V7); SEO-02 (no sitemap, robots, manifest → SEO-V1); LEG-02 (no date → LEG-V1) | |

---

## 6. Proposed folder structure

The structure starts from what `v2` has (`src/app`, `src/components`, `src/lib`, `src/tools`) and separates the
concerns that are mixed today (QLT-V3 to QLT-V5). Files are moved with `git mv` so their history is kept.

```
DocuMorph/
├── public/
│   ├── fonts/NotoSans-Regular.woff2   # was .ttf; fallback font for saved PDF text
│   ├── apple-touch-icon.png, favicon.ico, icon-192.png, icon-512.png
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # fonts, metadata, viewport (viewport-fit=cover), shell
│   │   ├── globals.css                # Tailwind import + the one set of design tokens
│   │   ├── page.tsx                   # the tool list
│   │   ├── [tool]/page.tsx            # all fourteen tools from one registry (replaces nine copies)
│   │   ├── privacy/page.tsx
│   │   ├── terms/page.tsx             # if D4 restores Terms
│   │   ├── feedback/page.tsx          # if D1 restores feedback
│   │   ├── not-found.tsx, error.tsx
│   │   ├── icon.svg, opengraph-image.tsx, manifest.ts, robots.ts, sitemap.ts
│   │   └── api/
│   │       ├── convert/route.ts       # kept, hardened
│   │       ├── form/route.ts          # if D1
│   │       ├── wallets/route.ts       # if D2
│   │       └── blob-upload/route.ts   # if D3
│   ├── components/
│   │   ├── ui/                        # Button, IconButton, Field, Select, RadioGroup, Checkbox, Slider,
│   │   │                              # Stepper, Dialog, Sheet, ProgressBar, Notice, Badge, VisuallyHidden
│   │   └── layout/                    # Header, ToolMenu (sheet on phones), Footer, Logo, ThemeSwitch,
│   │                                  # ToolShell, ActionBar (bottom bar with safe-area padding)
│   ├── features/
│   │   ├── files/                     # Dropzone, FileList (touch reordering), Results, save-or-share
│   │   ├── editor/                    # EditorScreen, PageSurface, gesture and zoom handling, ToolBar,
│   │   │                              # TextSheet, SignatureSheet, PageNavigator, FormPanel,
│   │   │                              # editor-state.ts (document, history), draft-store.ts
│   │   ├── merge/, split/, organise/, images-to-pdf/, pdf-to-images/
│   │   ├── image/                     # convert, resize, compress
│   │   ├── server-convert/            # upload with progress, cancel, retry, auto-delete
│   │   ├── feedback/, donate/         # if D1, D2
│   │   └── legal/
│   ├── lib/                           # pure, tested: coords, ranges, target-size, files, format,
│   │   └── pdf/                       # ops.ts (pdf-lib), render.ts (pdf.js) — kept
│   ├── server/                        # server-only: env.ts (zod), convertapi.ts, rate-limit.ts, http.ts
│   ├── schemas/                       # zod schemas shared by browser and server
│   ├── config/                        # site.ts, tools.ts (one registry), limits.ts
│   └── types/
├── tests/
│   ├── unit/                          # Vitest (the 26 existing tests move here and grow)
│   └── e2e/                           # Playwright: phone and desktop projects, axe checks, screenshots
├── .env.example                       # names only (with a `!.env.example` exception in .gitignore)
├── .github/workflows/ci.yml           # install, lint, type check, unit tests, build, e2e
├── eslint.config.mjs, next.config.ts, postcss.config.mjs, tsconfig.json
├── vitest.config.mts, playwright.config.ts
├── AGENTS.md, LICENSE, README.md, REBUILD_PLAN.md
└── package.json
```

`src/tools/` disappears into `src/features/`; `scripts/copy-pdf-worker.mjs` is removed if the worker can be
resolved by the bundler, which also removes the cause of BUG-V1 (phase 0 decides, with a recorded reason).
Nothing old is kept beside the new.

---

## 7. Proposed design direction

**In one line:** a quiet, exact utility that is designed for a phone held in one hand — ink on paper, the
owner's teal reserved for the action that moves a job forward, figures in a monospaced face, and the tool
itself on the first screen.

People hand this site contracts, payslips and identity documents, so it must look trustworthy rather than
decorative: flat, bordered surfaces and plain statements about where a file goes. `v2` already points this
way; the rebuild keeps its character and replaces what was only sketched (DES-V1) with a complete system,
drawn first at 360, 390 and 430 px (section 13).

### 7.1 What is kept and what changes

| Existing in `v2` | Decision |
| --- | --- |
| The name, wordmark and the document-and-arrow logo (`src/components/Logo.tsx:2-10`) | Kept |
| Teal accent `#0f766e` light, `#2dd4bf` dark (`src/app/globals.css:12`, `:27`) | Kept. White on it is 5.47:1; it passes AA. (The first version of this plan proposed a darker "spruce" green; with `v2` as the base there is no reason to change the owner's colour. D9 records the choice.) |
| The semantic token names `bg`, `surface`, `raised`, `line`, `fg`, `muted`, `subtle`, `accent`, `warn`, `danger` (`src/app/globals.css:35-50`) | Kept, so existing class names continue to mean the same thing |
| `--subtle` and the use of `--line` for control borders | Changed: they fail contrast (A11Y-V1, A11Y-V2) |
| Geist and Geist Mono (`src/app/layout.tsx:8-9`) | Kept. Already self-hosted and in use; replacing them would be change for its own sake |
| Light and dark themes with a manual switch | Kept |
| `.btn` and `.field` at 14 px | Replaced by components at 16 px with 44 px minimum height |
| Translucent blurred header | Replaced by a solid surface with a hairline |

### 7.2 Palette

One neutral family, one accent, two functional colours. No gradients anywhere. Values marked * are new; the
rest are `v2`'s.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg` | `#f6f7f9` | `#0d1117` | Page |
| `surface` | `#ffffff` | `#151b23` | Panels, bars, sheets |
| `raised` | `#eef1f4` | `#1c232d` | Sunken areas, drop zone, selected rows |
| `line` | `#dde2e8` | `#2a323d` | Decorative dividers only |
| `control` * | `#6a7280` | `#6b7686` | Borders of inputs, buttons and the drop zone |
| `fg` | `#111827` | `#e8ecf1` | Body text |
| `muted` | `#4b5563` | `#a7b0bd` | Secondary text |
| `subtle` * | `#5f6877` (was `#7b8494`) | `#8d97a6` (was `#758091`) | Meta text: sizes, hints |
| `accent` | `#0f766e` | `#2dd4bf` | Primary button, links, focus, progress, selection |
| `accent-hover` * | `#0b5f59` | — (opacity change kept) | Pressed and hover |
| `accent-tint` * | `#e7f1f0` | `rgba(45,212,191,0.12)` (as `v2`) | Selected and informational backgrounds |
| `accent-fg` | `#ffffff` | `#062521` | Text on the accent |
| `warn` * | `#92400e` (was `#b45309`) | `#f5a524` | Warnings |
| `danger` | `#b42318` | `#f97066` | Errors, destructive actions |

**Contrast (WCAG 2.2, computed with a script from the relative-luminance formula on 18 November 2026):**

| Pair | Ratio | Result |
| --- | --- | --- |
| `fg` on `bg` / `surface` / `raised` | 16.55 / 17.74 / 15.65 | AAA |
| `muted` on `bg` / `surface` / `raised` | 7.05 / 7.56 / 6.67 | AA or better |
| `subtle` on `bg` / `surface` / `raised` | 5.25 / 5.63 / 4.96 | AA |
| White on `accent` | 5.47 | AA |
| White on `accent-hover` | 7.51 | AAA |
| `accent` on `surface` / `bg` / `raised` / `accent-tint` | 5.47 / 5.11 / 4.83 / 4.75 | AA |
| `fg` on `accent-tint` | 15.41 | AAA |
| `warn` on `surface` / `bg` | 7.09 / 6.61 | AA or better |
| `danger` on `surface` / `bg` / tint `#fdecea` | 6.57 / 6.13 / 5.75 | AA |
| `control` border on `surface` / `bg` (3:1 needed) | 4.85 / 4.52 | Pass |
| Dark: `fg` on `bg` / `surface` | 15.95 / 14.59 | AAA |
| Dark: `muted` on `bg` / `raised` | 8.64 / 7.22 | AAA |
| Dark: `subtle` on `bg` / `surface` / `raised` | 6.41 / 5.86 / 5.36 | AA |
| Dark: `accent-fg` on `accent` | 8.72 | AAA |
| Dark: `accent` on `bg` / `surface` / `raised` | 10.17 / 9.30 / 8.50 | AAA |
| Dark: `warn` on `surface`; `danger` on `bg` / `surface` | 8.48; 6.79 / 6.21 | AA or better |
| Dark: `control` border on `surface` / `bg` (3:1 needed) | 3.76 / 4.11 | Pass |

For comparison, `v2` today: `subtle` 3.52 on the page and 3.77 on white (fail); dark `subtle` 4.33 on a surface
(fail); `line` as a control border 1.30 and 1.34 (fail). The table is re-computed from the shipped tokens
before release (section 14 (e)).

### 7.3 Typography

**Geist** for the interface and **Geist Mono** for figures: file sizes, pixel dimensions, page counts, page
ranges, percentages and (if restored) wallet addresses. Both are already loaded with `next/font` and served
from the site's own origin. Weights: 400, 500 and 600.

| Token | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| `display` | 28 / 34 px on phones; 36 / 44 px from 768 px | 600 | Page heading, one per page |
| `title` | 20 / 28 px | 600 | Sheet, dialog and section headings |
| `body` | **16 / 24 px** | 400 | Default text, every input, select and button label |
| `label` | 16 / 24 px | 500 | Form labels, buttons |
| `body-sm` | 14 / 20 px | 400 | Secondary lines on screens from 768 px; never an input |
| `caption` | 13 / 18 px | 400 | The smallest text permitted, for non-essential meta only |
| `data` | 15 / 22 px, Geist Mono | 500 | Figures |

Body text is 16 px at every width. Inputs are 16 px so iOS does not zoom on focus (MOB-06). Line length is
capped at 68 characters (`max-width: 68ch`) for running text. Tracking of −0.01 em on `display` only.

### 7.4 Layout

- **Designed first at 360, 390 and 430 px**, in one column with 16 px side padding, then widened.
- **Container:** maximum 1120 px (1280 px for the editor and Organise), 24 px side padding from 640 px.
- **Breakpoints:** 640, 768, 1024, 1280, 1536 px (Tailwind's defaults, as `v2` uses).
- **From 1024 px** a tool page uses 7 of 12 columns for the work surface and 5 for a side panel ("What happens
  to your file", options); below that, one column with the options in a sheet or above the action.
- **The primary action is at the bottom on phones**, in a bar within thumb reach (section 13.3), and inline on
  wider screens.
- **Alignment:** left-aligned throughout. Nothing is centred except the contents of an empty drop zone.

### 7.5 Scales

| Scale | Values | Reason |
| --- | --- | --- |
| Spacing (4/8-based) | 0, 2, 4, 8, 12, 16, 24, 32, 48, 64 px | One rhythm; 16 inside components, 24 between them |
| Control height | 44 px (default), 48 px (primary actions in the bottom bar), 36 px visual with a 44 px hit area only inside the dense desktop editor toolbar | Meets the 44 px rule on touch |
| Radius | `sm` 4 px, `md` 8 px (buttons, inputs), `lg` 12 px (panels, sheets) | Replaces six ad-hoc radii; no pills |
| Shadow | none by default (1 px borders separate surfaces); `sm` for raised controls; `md` for sheets, menus and dialogs only | Shadow marks what floats |
| Icons | Lucide, 20 px, 1.5 px stroke; 24 px in the phone tool bar, always with a text label there | One set, already in `v2` |

### 7.6 Motion

- 120 ms for hover, focus and pressed; 200 ms for sheets, dialogs and state changes; `ease-out`.
- Only `opacity` and `transform` are animated, plus the width of the progress bar. Sheets slide from the
  bottom on phones.
- No hover lift, glow, bounce or shake.
- Progress is determinate wherever a real figure exists (upload, "page 3 of 12") and an honest indeterminate
  bar where it does not (the conversion itself).
- `prefers-reduced-motion: reduce` removes every transition except the progress bar's.

### 7.7 Key screens

Each is described phone first; section 13.10 gives the checklist for every address.

**Home (`/`).** A 56 px header: logo and wordmark at the left, a "Tools" button and the theme switch at the
right. One sentence ("Edit, sign and convert documents. Nine of fourteen tools never upload your file."), then
the tools straight away, as four labelled groups of full-width rows — icon, name, one-line summary, and a
"server" tag where it applies — each row at least 56 px tall. Edit PDF, the most-used phone task, is first.
From 768 px the rows become a two-column list, from 1024 px three columns. No hero, no feature cards.

**Tool page.** Header; "All tools" link; the heading in plain words and one sentence; a "Runs on your device"
or "Sent to ConvertAPI" line with a "What happens to my file?" link. Then the drop zone: a `raised` panel with
a `control` dashed border, "Choose a PDF" as a full-width 48 px primary button, the accepted types and limit
in words, and, on wide screens only, "or drop it here". Once a file is chosen the page becomes: the file row
(name, size or dimensions in mono, "Remove"), the options, and a **bottom action bar** holding the primary
action ("Merge 3 PDFs", "Compress", "Convert to PDF") with any secondary action beside it. While working, the
bar shows progress and "Cancel". When done, the result rows and a bar with "Save" (or "Share" where the phone
supports sharing files) and "Start again". Errors are an inline notice stating what failed and what to do.

**Editor (`/edit-pdf`).** Section 13.8 describes it in full: the page fills the screen; a slim top bar (close,
"3 / 12", undo, redo, Save); a bottom tool bar with labelled tools; a sheet for text entry that stays above
the keyboard; a full-width signature sheet; pinch to zoom and two-finger pan at all times.

**Privacy (and Terms, if restored).** A single text column of at most 68 characters, `title` headings, a real
date, and a contact line if the owner supplies one.

**Feedback and Donate (only if restored).** Feedback: a page, opened as a bottom sheet from the footer on
phones, with a category select, an optional e-mail field, a message field and "Send"; states shown inline.
Donate: a coin select, a network select for USDT only, a locally drawn QR code, the address in mono and a
"Copy" button of full width.

**Not found and error pages.** One sentence and a link back to the tools.

---

## 8. Rebuild plan

### 8.1 Phases and commits

The starting point is `rebuild/production` at `origin/v2`. Each commit builds, lints and type-checks cleanly
by itself; from phase 0 onwards the quality gates of section 14 run in continuous integration. Code that is
replaced is deleted in the same commit. Nothing is merged into `main` or `v2`.

**Phase 0 — Make the base pass its own checks (1 day)**

1. `fix(lint): stop linting the copied PDF worker at its cause` — resolve the worker through the bundler and
   remove the copy script if Turbopack allows; otherwise exclude that one generated, Git-ignored file with the
   reason recorded. The project's own code keeps every rule. (BUG-V1)
2. `chore: zero-warning lint script, stricter compiler options, Prettier`
3. `chore: Playwright with phone and desktop projects, axe, and a CI workflow`
4. `chore: .env.example (names only), LICENSE, engines, dependency upgrades`
5. `refactor: remove non-null assertions and the eslint-disable by typing the causes` (QLT-V1, QLT-V2)

**Phase 1 — Design system and shell, phone first (3 days)**

6. `feat(design): colour, type, spacing, radius, shadow and motion tokens; contrast fixes`
7. `feat(ui): Button, IconButton, Field, Select, RadioGroup, Checkbox, Slider, Stepper at touch sizes`
8. `feat(ui): Dialog and bottom Sheet with focus handling; ProgressBar; Notice`
9. `feat(layout): header, tool menu, footer, bottom action bar with safe-area insets` (NAV-03, NAV-05, NAV-06 restored in a new form)
10. `feat(home): the tool list as the first screen` (SHL-01, SHL-02)
11. `feat(app): one tool registry and route; not-found and error pages` (QLT-V10)

**Phase 2 — Server (2 days)**

12. `feat(server): zod-validated environment and request schema` (SEC-V3, SEC-V9)
13. `fix(api): count a conversion only when it succeeds; secret in a header if supported` (BUG-V2, SEC-V2)
14. `feat(api): return the converted file through a same-origin download and delete it afterwards` (SEC-V4, BUG-V3; method settled against ConvertAPI's documentation and Vercel's response limits)
15. `feat(api): limit the delete call; visitor key hardened` (SEC-V6, SEC-V7)
16. `test(server): route handler tests — every refusal, the limit, the delete call`

**Phase 3 — Files in, files out, and the nine simpler tools (4 days)**

17. `feat(files): Dropzone for phones — accept lists, HEIC handling, visible focus, clear refusals` (MOB-14, MOB-15, A11Y-V3, BUG-V4)
18. `feat(files): device-aware size and pixel limits with plain warnings` (MOB-12, MOB-13)
19. `feat(files): touch reordering for file lists` (MOB-16)
20. `feat(files): results with Save, Share and zip; dimensions before and after` (MOB-17, RSZ-04, RSZ-05)
21. `feat(server-convert): upload progress, cancel, time limit, retry, offline message` (MOB-08, FLW-11, FLW-12)
22. `feat(image): convert, resize and compress on the new components`
23. `feat(merge)`, 24. `feat(split)`, 25. `feat(organise)`, 26. `feat(images-to-pdf)`, 27. `feat(pdf-to-images)` — one commit each, with its tests
28. `perf: load pdf-lib and pdf.js only when a file is chosen` (PERF-V1)

**Phase 4 — The PDF editor on a phone (5 days)**

29. `refactor(editor): separate document state and history from the view; unit tests` (QLT-V3)
30. `feat(editor): gesture model — one finger scrolls, two fingers zoom and pan, armed tools draw` (MOB-01, MOB-02, MOB-09)
31. `feat(editor): top bar and bottom tool bar with labelled tools` (MOB-03, MOB-04, DES-V6)
32. `feat(editor): text sheet above the keyboard; style controls` (MOB-02, MOB-06)
33. `feat(editor): selection with 44 px handles; move, resize, delete by touch and by keyboard` (MOB-05, A11Y-V5)
34. `feat(editor): signature sheet — smoothed strokes, rotation-safe, bundled script face` (MOB-10, MOB-11, A11Y-V6)
35. `feat(editor): page navigator and form panel` (A11Y-V9)
36. `feat(editor): draft kept on the device and restored after a discarded tab` (MOB-18)
37. `feat(editor): save and share; release pages that scroll away` (MOB-13, MOB-17)

**Phase 5 — Items live on `main`, as the owner decides (0 to 4 days)**

Each is built only on a "yes" in section 9, on the new design system, to the standards of section 11:

38. `feat(feedback)` (D1; FBK-01 to FBK-05, API-05) — 39. `feat(donate)` (D2; DON-01 to DON-06, API-06) —
40. `feat(upload): large files through Vercel Blob, deleted after use` (D3; FLW-13, API-01) —
41. `feat(legal): Terms page` (D4; LGL-01) — 42. `feat(footer): credit, copyright, social links` (D5).

**Phase 6 — Metadata, security, performance (2 days)**

43. `feat(seo): canonical addresses, sitemap, robots, manifest, icon set, per-tool share images` (SEO-V1, SEO-V2)
44. `feat(security): Content-Security-Policy, tested in report-only mode first` (SEC-V1)
45. `perf: bundle, font and image budgets enforced in CI` (section 13.7)
46. `feat(offline): cache the shell and the device tools` (only if D11 says yes)
47. `docs: privacy page updated for what the rebuild stores on the device; README`

**Phase 7 — Verification and release (4 days)**

48. `test(e2e): the flows of section 14 (b), on the phone and desktop projects`
49. `test(a11y): axe on every page and state; keyboard walkthroughs`
50. `fix: findings from screenshots, real-device checks, Lighthouse and the independent review` — one small commit per finding
51. Pull request with before and after screenshots, phone first, and the Lighthouse scores. **Merged and deployed only with the owner's approval** (section 14 (i)).

### 8.2 Verification plan

Section 14 is the authority; this table maps it to the phases.

| Check | Method | Pass condition |
| --- | --- | --- |
| Build | `npm run build` | Exit 0, no warnings |
| Lint | `npm run lint` (`eslint --max-warnings 0`) | 0 errors, 0 warnings; no rule disabled in code or loosened in configuration |
| Types | `npm run typecheck` | 0 errors under `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Unit tests | `npm test` | All pass; the 26 existing tests still pass |
| Parity | The 151 items of section 2, each ticked against a named test or a recorded manual check | 151 of 151, with any owner-approved omission written beside the item |
| End-to-end | Playwright, phone (390 × 844, touch) and desktop (1280 × 800) projects | Every flow in section 14 (b) passes on both |
| No upload from device tools | Playwright records network requests during each of the nine device tools | No request carries file bytes; no request leaves the site's origin |
| Live conversion | One real run of each of the five server tools on a Vercel preview | Each produces a correct file and it is deleted afterwards |
| Real phones | iPhone (Safari) and a mid-range Android (Chrome): pick, edit, sign, save, share | Section 13.10 completed on both |
| Widths and themes | Screenshots at 360, 390, 768, 1024, 1280 and 1536 px, light and dark | No horizontal scroll; nothing clipped or covered; targets ≥ 44 px on touch widths; body text ≥ 16 px |
| Accessibility | axe on every page and state; keyboard walkthrough; VoiceOver and TalkBack spot checks | WCAG 2.2 AA; 0 axe violations |
| Lighthouse | Mobile, against the Vercel preview, every address | ≥ 90 in all four categories; LCP < 2.5 s, CLS < 0.1; INP < 200 ms measured in the browser tests |
| Security headers | `curl -I` on the preview | CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame protection |
| Abuse resistance | Scripted calls to `/api/convert`: unlisted tool, renamed file, over-size body, past the limit, malformed delete | Each refused with the right status and a readable message |
| Dependencies | `npm audit --omit=dev`; `npm audit` | 0 in shipped packages; development findings reviewed and recorded |

### 8.3 Effort estimate

| Phase | Working days |
| --- | --- |
| 0 Make the base pass | 1 |
| 1 Design system and shell | 3 |
| 2 Server | 2 |
| 3 Files and the nine simpler tools | 4 |
| 4 The PDF editor on a phone | 5 |
| 6 Metadata, security, performance | 2 |
| 7 Verification and release | 4 |
| **Total without phase 5** | **21** |
| 5 Items from `main`, if restored | feedback 1, donations 1, large uploads 1.5, Terms and footer 0.5 |

Elapsed time depends on how quickly the decisions in section 9 arrive. D1 to D5 are needed before phase 5;
the ConvertAPI test allowance before phase 2; access to real phones before phase 4 ends.

### 8.4 Risks and mitigations

| Risk | Likelihood | Effect | Mitigation |
| --- | --- | --- | --- |
| A touch gesture model that satisfies scrolling, zooming and drawing at once is hard to get right | High | The editor stays awkward on phones, which is the main goal | Build it first in phase 4, behind tests that dispatch real touch sequences, and try it on real devices before the remaining editor work |
| Mobile browsers run out of memory on large PDFs and photographs | High | Tab discarded, work lost | Device-aware limits with a plain warning, pages released when off screen, one copy of the file, drafts kept on the device |
| Behaviour differs between iOS Safari, Android Chrome and in-app browsers (file pickers, HEIC, downloads, fonts) | High | Works in tests, fails for customers | Every † item in section 5.1 is confirmed on real phones; "Share" offered beside "Save"; a notice with "Open in your browser" when an in-app browser cannot save |
| A strict Content-Security-Policy conflicts with static pre-rendering or the PDF worker | Medium | Either a weaker policy or slower pages | Decide between hashes and nonces with the Next documentation in hand; run report-only on the preview across every flow first |
| ConvertAPI behaviour differs from what the code assumes (header secret, delete call, presets) | Medium | A server tool fails | Check against its documentation and a test account at the start of phase 2; stub it in automated tests |
| ConvertAPI allowance is consumed by testing | Medium | The live site stops converting | Live checks once, on a preview, with a separate secret if the owner can provide one |
| Replacing `pdf-lib` with its maintained fork changes output | Medium | Saved PDFs differ | Only after the existing PDF tests and new visual comparisons pass on both; otherwise stay on 1.17.1 with the reason recorded |
| Shared IP addresses (offices, mobile carriers) reach the daily limit early | Medium | Legitimate users refused | Limit configurable; remaining allowance shown; owner chooses the figure (D8) |
| The live site and the rebuild differ in addresses | Low | Old links break | `main` has one address, `/`, which remains; restored API paths keep their names |
| Scope growth from the `main` items | Medium | The mobile work is delayed | Phase 5 is separate and sized per item |
| TypeScript 7 and ESLint 10 are current but unsupported by the lint tooling | Certain | Not on the latest of two tools | Pin 6.0.3 and 9.39.5 with the reason recorded; revisit when the ranges widen |

---

## 9. Needed from the owner

### 9.1 Decisions

| # | Question | Recommendation |
| --- | --- | --- |
| D1 | **Feedback form** (live on `main`, removed in `v2`, undecided): bring it back, with Formspree, or leave it out? | Bring it back in a small form. A free tool with no accounts has no other way to hear that something is broken. Leave out the automatic pop-up after rejected files |
| D2 | **Donations and wallets** (live on `main`, removed in `v2`): dropped on purpose, or restore? | Owner's call. If restored: QR code drawn locally, only coins with an address shown |
| D3 | **Large files for the five server tools** (50 MB through Vercel Blob on `main`; 4 MB in `v2`): restore, or keep 4 MB? | Keep 4 MB at launch and say so plainly; restore only if customers ask, because it brings back stored uploads |
| D4 | **Terms of Service and the consent tick box** (live on `main`, removed in `v2`) | A Terms page; no tick box |
| D5 | **Footer**: "Powered by ConvertAPI", the copyright line, LinkedIn and X links (live on `main`; `v2` has Source code and "Built by") | Restore the credit if the ConvertAPI plan requires it; add the copyright line; social links as text |
| D6 | Confirm these defective `main` behaviours stay out: PDF "target size" (CMP-07), the pretend upload animation (FLW-06), the result preview that never showed (FLW-19), the open proxy mode (API-04) | Leave out |
| D7 | **BMP and TIFF** images (accepted on `main`, not in `v2`) | Leave out unless needed; browsers cannot read TIFF, so it would mean uploading |
| D8 | **Daily limit** for server conversions: five (as `main`) or ten (as `v2`)? Show the remaining number? | Ten, shown |
| D9 | **Accent colour**: keep `v2`'s teal | Keep |
| D10 | **Typeface**: keep `v2`'s Geist | Keep |
| D11 | **Offline use**: let the device tools work without a connection after the first visit, and let the site be added to the home screen? | Yes |
| D12 | **PDF library**: evaluate the maintained fork of `pdf-lib` | Evaluate; switch only if every test passes |
| D13 | **Converted files**: delete from ConvertAPI automatically once downloaded, instead of relying on "Delete it now" | Yes |
| D14 | **Editor drafts**: keep unfinished edits on the device (never uploaded) so that a phone that discards the tab does not lose work, and say so on the privacy page | Yes |
| D15 | **Camera** for "Images to PDF": a "Take a photo" button beside "Choose images" | Yes |
| D16 | Controls changed in `v2` (section 2.4): percentage sliders in place of the 1–9 slider and the four fixed scales | Accept `v2`'s |
| D17 | Public repository and licence. `main`'s README said MIT; there is no `LICENSE` file on either branch | Confirm; the file is added on a "yes" |
| D18 | **How the rebuild goes live**: it replaces the site that runs `main`. Confirm that `main` and `v2` stay untouched until then and name who presses the button | Preview first, then the owner's approval |

### 9.1a Owner decisions of 19 November 2026 (applied in session 2)

| # | Decision | What was built |
| --- | --- | --- |
| D1 | Feedback: bring it back, small | "Send feedback" in the footer and the phone Tools sheet opens a form (message required, optional e-mail, the page it was sent from). `POST /api/feedback` validates with zod, limits to 5 a day per visitor, and e-mails the owner only through Resend (`RESEND_API_KEY`, `FEEDBACK_TO_EMAIL`). Nothing is stored. No automatic pop-up after rejected files (FLW-05 stays out) |
| D2 | Donations: no wallets; one "Buy me a coffee" link | `NEXT_PUBLIC_BUYMEACOFFEE_URL`. Footer, Tools sheet and a quiet line on the success screen. Plain text and a Lucide coffee cup; no branded button. Hidden when unset. Coins, QR code and `/api/wallets` are not rebuilt |
| D3 | Large files | Browser tools take up to 100 MB, with a phone warning from 25 MB. Server conversions stay at 4 MB, with a clear message. **The 4 MB limit is Vercel's request-body limit (4.5 MB), not the converters'**: raising it would need uploads straight to storage, which the plan avoids |
| D4 | Terms and consent | `/terms` beside `/privacy`; one line under every upload area; no tick box, no cookie banner (no tracking cookies). On device tools the line says the file is processed on the device and not uploaded, because "deleted straight after" would be untrue there |
| D5 | Footer | Owner's name (links to `NEXT_PUBLIC_PORTFOLIO_URL`, plain text when unset), Privacy, Terms, Feedback, Buy me a coffee. "Powered by ConvertAPI" and social links are gone |
| D6 | Four defective behaviours stay out | CMP-07, FLW-06, FLW-19, API-04 |
| D17 | Licence | Proprietary: `LICENSE`, `"license": "UNLICENSED"`, no open-source claim anywhere |
| Domain | `*.vercel.app` for now | The site address comes only from `NEXT_PUBLIC_SITE_URL`, which a production build now requires |
| Converter | ConvertAPI removed | Word and Excel to PDF: Gotenberg on Cloud Run (`infra/gotenberg/`). PDF to Word and PDF to Excel: Adobe PDF Services free tier, with a monthly and a daily cap for the whole site. Compress PDF: in the browser |

### 9.2 Environment variable names (values are never to be sent in chat or committed)

| Name | Read by | Status | Purpose |
| --- | --- | --- | --- |
| `CONVERTAPI_SECRET` | `v2` (`src/app/api/convert/route.ts:30`, `:107`) and `main` | Exists on the live project under this name | ConvertAPI |
| `CONVERT_DAILY_PER_VISITOR` | `v2` (`src/app/api/convert/route.ts:18`) | Optional; default 10 | Daily limit per visitor |
| `CONVERT_DAILY_SITE_CAP` | `v2` (`src/app/api/convert/route.ts:19`) | Optional; default no cap | Daily limit for the whole site |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | `v2` (`src/lib/rate-limit.ts:49-50`) | Optional; without them the limit is approximate | Shared counts |
| `NEXT_PUBLIC_SITE_URL` | `v2` (`src/lib/tools.ts:35`) | Optional today; to be required | Canonical addresses, sitemap, share images |
| `BLOB_READ_WRITE_TOKEN` | `main` only | Needed only if D3 restores large uploads | Vercel Blob |
| `FORMSPREE_ENDPOINT` | `main` only | Needed only if D1 restores feedback | Feedback forwarding |
| `WALLET_BTC`, `WALLET_ETH`, `WALLET_BNB`, `WALLET_SOL`, `WALLET_TON`, `WALLET_TRON`, `WALLET_USDT_ETH`, `WALLET_USDT_BNB`, `WALLET_USDT_TRC`, `WALLET_USDT_SOL`, `WALLET_USDT_TON`, `WALLET_USDT_ARB` | `main` only | Needed only if D2 restores donations | Donation addresses |

Please confirm which of these are set on the Vercel project, by name only.

### 9.3 Content and assets

- **Privacy text**: `v2`'s page is accurate for `v2`. It will be extended for whatever the rebuild adds (drafts
  on the device, offline cache, any restored feature) and needs the owner's approval, a real date, and a
  contact address if one is to be published.
- **Terms of Service text**, if D4 restores it: `main`'s text describes the old product and must be rewritten
  and approved, not copied.
- **The donation sentence**, if D2: what "250 Monthly Quota" (`main:index.html:858`) was meant to tell a donor.
- **A script typeface for typed signatures**, chosen with the owner from openly licensed faces, so that a typed
  signature looks the same on every phone (MOB-11).
- **Images to be produced from the existing logo and tokens** (no stock imagery): share images, 1200 × 630 px;
  favicon set (SVG, 32 px ICO, 192 and 512 px PNG, 180 px Apple touch icon).
- **Sample files for testing**, free of personal data: `.doc`, `.docx`, `.xls`, `.xlsx`; a multi-page PDF, a PDF
  with a form, a rotated PDF, a password-protected PDF, a PDF over 50 MB; JPEG, PNG, WebP and HEIC photographs
  from a phone, including one above 12 megapixels.

### 9.4 Accounts, domain and devices

- **The production domain.** `v2` names `https://documorph-blue.vercel.app` (`README.md:5`,
  `src/lib/tools.ts:35`). Confirm that this is the live address, or supply the custom domain and its DNS access.
- **Vercel**: which project serves `main` today, the plan (it sets function duration and body limits), and
  permission to create preview deployments from `rebuild/production`.
- **ConvertAPI**: whether a second secret can be issued for previews, and whether the plan requires the
  "Powered by" credit.
- **Upstash**: a free Redis database, or agreement that the limit stays approximate (SEC-V5).
- **Real phones**: an iPhone and a mid-range Android phone for the checks in section 13.10, or the owner's help
  in running them.

---

## 10. Schema changes

**None proposed.** DocuMorph has no database and the rebuild does not introduce one. The stores involved are
described for completeness and approval:

- **Rate-limit keys** (exist in `v2`, in memory or Upstash Redis): `dm:<yyyy-mm-dd>:v:<hash>` and
  `dm:<yyyy-mm-dd>:site`, each an integer with a 24-hour expiry (`src/lib/rate-limit.ts:61`, `:64`), where
  `<hash>` is 22 characters of a SHA-256 of the date and the visitor's IP address
  (`src/app/api/convert/route.ts:23-27`). No raw address, file name or file content is stored.
- **Browser local storage** (exists in `v2`): the key `theme`, holding `light` or `dark`
  (`src/components/Header.tsx:21`). `main`'s key `documorph_usage` is no longer read.
- **Editor drafts** (new, only if D14 is approved): one record in the browser's IndexedDB holding the open PDF
  and its unsaved edits, on the device only, removed on save or close and after seven days.
- **Offline cache** (new, only if D11 is approved): the site's own pages, scripts, fonts and PDF worker in the
  browser's cache storage. No file chosen by a visitor is cached.

---

## 11. Code and design standards

The rebuild is governed by the following commitments. Sections 3, 6, 7, 8 and 13 have been written to comply
with them, and section 14 lists the gates that prove it.

**Code**

- **TypeScript strict.** No `any`; no `ts-ignore`, `ts-expect-error` or `ts-nocheck`; no `eslint-disable`; no
  `as unknown as X`; no non-null `!` used to silence an error.
- **A clear structure.** UI components, feature modules, server and data logic, types, utilities and
  configuration are kept apart, in small, focused files.
- **One source of truth for each thing**: one Button, one byte formatter, one tool registry, one set of design
  tokens.
- **zod validation on the server**; real error messages; no empty `catch` blocks; loading, empty and error
  states on every asynchronous screen.
- **No `console.log`, commented-out code, dead code, TODOs, lorem ipsum or placeholder images.** Comments
  only where they explain a non-obvious *why*.
- **No patching.** Problems are fixed at the root. Configurations are never loosened. There are no re-export
  stubs, alias files or wrappers, and no old and new versions kept side by side.
- Build, lint and type check finish with zero errors and zero warnings.

**Design**

- **Mobile first.** Every screen is designed at 360, 390 and 430 px before any wider layout, with 16 px body
  text, 44 px targets and the primary action within thumb reach (section 13).
- The design must **not** look machine-generated. No purple, blue or pink gradients; no gradient text; no neon
  glows; no glassmorphism or blurred blobs; no emoji used as icons and no mixing of icon sets; not the stock
  template of a centred hero with two buttons, three identical feature cards, testimonials and a call-to-action
  banner; not every card in `rounded-2xl` with `shadow-lg` and hover-scale.
- The following copy is not to be used: "Unlock", "Elevate", "Seamless", "Revolutionize", "Supercharge",
  "Empower", "Next-level", "Your all-in-one solution", "Built for the future". Copy is plain, specific, in a
  human voice and in British English.
- Motion is subtle, quick and purposeful.
- Instead: a design system for the project (colour tokens, a type scale, a 4/8-based spacing scale, one radius
  scale, one shadow scale); a restrained palette (one accent, a well-built neutral scale); a deliberate font
  pairing; a strong grid and generous whitespace; one icon set; real images through `next/image` or the
  equivalent, with correct sizes and alt text.

**Process**

- Work stays on `rebuild/production` in small, logical commits as listed in section 8.1. `main` and `v2` are
  not modified.
- No secrets, `.env` files, production data or production services are read or written during the rebuild;
  live-service checks happen only on a preview deployment with the owner's agreement.
- Any item of the parity checklist that cannot be reproduced is reported to the owner with the reason, never
  dropped silently.
- Nothing is called done until every gate in section 14 passes.

---

## 12. The v2 base: keep or redo

`v2` is the base by the owner's decision. This section says, part by part, how much of it survives. The short
answer: **the engine is kept, the surface is rebuilt.** The code that reads, writes and converts files is
careful, tested work. The code that people touch was drawn for a desktop and does not yet work properly on a
phone.

| Part | Verdict |
| --- | --- |
| 12.1 Structure | **Keep with changes** |
| 12.2 Components | **Keep with changes** |
| 12.3 Design system | **Redo** (on the same token names, colour and typeface) |
| 12.4 Routes | **Keep** |
| 12.5 The PDF tools | Engine: **keep**. Simpler tool screens: **keep with changes**. Editor interaction: **redo** |
| 12.6 The API route | **Keep with changes** |
| 12.7 SEO | **Keep with changes** |
| 12.8 Tests | **Keep** and extend |

### 12.1 Structure — keep with changes

- *For keeping.* Clear top-level split of `src/app`, `src/components`, `src/lib` and `src/tools`; the library
  code is pure and free of React (`src/lib/pdf/ops.ts:1-2`, `src/lib/ranges.ts`, `src/lib/coords.ts`); one
  definition of the server tools is shared by the page and the route, so the server accepts exactly what the
  page offers (`src/lib/server-tools.ts:1-2`, `src/app/api/convert/route.ts:13`, `:40`).
- *For changing.* Helpers and a hook live in component files (`src/components/Results.tsx:78-83`,
  `src/components/usePdf.ts`, `src/components/FileOrder.tsx:59-60`); server-only code sits in `src/lib` beside
  browser code (`src/lib/rate-limit.ts`); nine tool pages are 16-line copies of one another
  (`src/app/merge-pdf/page.tsx:1-16`) while five more use a dynamic route (`src/app/[tool]/page.tsx`); there is
  no `ui/`, `server/`, `schemas/` or `config/`. Section 6 gives the target.

### 12.2 Components — keep with changes

- *For keeping.* `Dropzone` checks files by their contents and size and reports problems inline
  (`src/components/Dropzone.tsx:43-59`); `Results` handles one or many outputs, a zip and the saving in a
  single place (`src/components/Results.tsx:9-66`); `PageThumb` draws a page only when it scrolls into view
  (`src/components/PageThumb.tsx:14-29`); `ToolShell` gives every tool the same frame
  (`src/components/ToolShell.tsx:6-23`); errors are sentences (`src/components/Results.tsx:78-83`).
- *For changing.* There is no Button or Field component, only classes overridden at each use
  (`src/app/globals.css:68-115`; `src/components/FileOrder.tsx:43`); targets are 28 to 36 px (MOB-04); the
  drop zone has no visible keyboard focus (A11Y-V3); file reordering depends on mouse dragging (MOB-16); there
  is no Dialog, Sheet, ProgressBar or RadioGroup. The behaviour of each component is kept; its markup, sizes
  and styling are rebuilt on the `ui/` primitives.

### 12.3 Design system — redo

- *Evidence.* It consists of twelve colour variables and two font variables (`src/app/globals.css:4-50`), two
  utility classes (`:68-115`) and nothing else: no type, spacing, radius, shadow or motion scale. Two of the
  colours fail contrast where they are used (A11Y-V1, A11Y-V2). Controls and inputs are 14 px (`:76`, `:108`).
  Six radii are in use (DES-V3). No screen was designed for a phone (DES-V5).
- *What survives.* The token names, the teal accent, the neutral character, Geist, the logo and the light and
  dark themes (section 7.1). "Redo" here means completing and correcting the system, not changing the
  product's look.

### 12.4 Routes — keep

- *Evidence.* One address per tool with its own title, description and canonical address
  (`src/app/edit-pdf/page.tsx:8`); the five server tools are generated from the registry and unknown names
  return "not found" (`src/app/[tool]/page.tsx:8-12`, `:21`); `params` is awaited as the installed Next
  version requires (`:14`, `:19-20`); the build pre-renders all of them (section 4.1). British spelling in the
  address `/organise-pdf` is deliberate and stays.
- *Small changes.* Serve all fourteen tools from the one registry and route (QLT-V10); add `not-found.tsx`,
  `error.tsx`, and the metadata routes of section 12.7. Addresses do not change.

### 12.5 The PDF tools — keep the engine, redo the editor's interaction

- *Engine: keep.* `src/lib/pdf/ops.ts` (merge, organise, split, images to PDF, form reading and filling,
  applying edits) is pure, runs in Node, and is covered by ten tests (`src/lib/__tests__/pdf.test.ts:22-91`),
  including pages stored rotated, the Unicode fallback with Yoruba text and form flattening. Coordinate
  conversion is isolated and tested for every rotation (`src/lib/coords.ts:28-52`,
  `src/lib/__tests__/basics.test.ts:56-86`). Rendering releases page memory and loads `pdf.js` only when
  needed (`src/lib/pdf/render.ts:8-13`, `:40`, `:59`). The editor's data model — edits held in page
  coordinates, with a 100-step history — is sound (`src/lib/pdf/ops.ts:122-145`,
  `src/tools/editor/PdfEditor.tsx:107-126`). Changes: load `pdf-lib` on demand (PERF-V1), cap canvas sizes
  (MOB-13), keep one copy of the file (MOB-12, BUG-V5).
- *Merge, Split, Organise, Images to PDF, PDF to images, the image tools: keep with changes.* Their logic is
  short and correct (`src/tools/MergePdf.tsx:20-31`, `src/tools/SplitPdf.tsx:41-59`,
  `src/tools/OrganisePdf.tsx:32-44`, `src/tools/ImageTool.tsx:38-73`). Each is re-laid for a phone on the new
  components, with its state moved out of the view and its `!` assertions removed
  (`src/tools/PdfToImages.tsx:29`, `:41`, `:42`, `:52`).
- *Editor interaction: redo.* `EditorPage.tsx`, the view half of `PdfEditor.tsx` and `SignaturePad.tsx` are
  rewritten. The page surface blocks touch scrolling and zooming (`src/tools/editor/EditorPage.tsx:130`); there
  is no zoom (`src/tools/editor/PdfEditor.tsx:447-448`); handles are 12 and 16 px (`EditorPage.tsx:150`,
  `:214`); the toolbar is at the top and wraps (`PdfEditor.tsx:289-323`); there is no cancel handling for
  touches (`EditorPage.tsx:131-133`); the signature pad is sized once and relies on desktop fonts
  (`src/tools/editor/SignaturePad.tsx:83-95`, `:115`); one component holds everything
  (`PdfEditor.tsx:45-492`). These are not defects to patch one at a time: the interaction was designed for a
  mouse, and section 13.8 designs it for a finger.

### 12.6 The API route — keep with changes

- *For keeping.* Only listed conversions and listed options (`src/app/api/convert/route.ts:40-41`, `:53-58`);
  the file's first bytes and its extension must both match the tool (`:47-51`); size is checked on the server
  (`:45`); a daily limit per visitor by hashed address, with an optional site cap (`:23-27`, `:60-70`); the
  route fails closed if the limit cannot be checked (`:71-74`); a 55-second time limit on the outgoing call
  (`:84`); refusals are readable and never cached (`:21`); only the status and ConvertAPI's message are logged
  (`:95`); the file is forwarded, not stored (`:76-79`).
- *For changing.* The limit is spent before the conversion and never returned (BUG-V2); a malformed limit
  setting disables it (SEC-V3); the secret is in the query string (SEC-V2); the result is left on ConvertAPI
  until someone deletes it and is downloaded from another origin (SEC-V4, BUG-V3); the delete call is
  unlimited (SEC-V6); validation is by hand and the route has no tests (SEC-V9, QLT-V8).

### 12.7 SEO — keep with changes

- *For keeping.* A title template and description (`src/app/layout.tsx:11-20`); a title, description and
  canonical address on every tool page (`src/app/split-pdf/page.tsx:8`); a generated share image
  (`src/app/opengraph-image.tsx`); an SVG icon; `lang="en-GB"`; one `<h1>` per page followed by `<h2>`
  (`src/components/ToolShell.tsx:15`, `src/app/page.tsx:48`, `:68`). Lighthouse gave SEO 100 on the three pages
  measured earlier (section 4.1).
- *For adding.* `sitemap.ts`, `robots.ts`, `manifest.ts`, a raster icon set, canonical addresses for `/` and
  `/privacy`, a share image per tool, and a required `NEXT_PUBLIC_SITE_URL` in place of the address written
  into the code (SEO-V1 to SEO-V3).

### 12.8 Tests — keep and extend

- *For keeping.* 26 tests in two files, all passing in under a second (section 4.1): file signatures, safe
  renaming, size formatting, page ranges and their error messages, coordinate round-trips at four rotations,
  the target-size search, the rate limit and its site cap, the route mapping
  (`src/lib/__tests__/basics.test.ts:11-124`), and ten PDF operations (`src/lib/__tests__/pdf.test.ts:22-91`).
- *For adding.* Nothing tests the route handler, any component, or any flow in a browser, and there is no
  continuous integration (QLT-V8, QLT-V7). Section 14 (b) lists what is added.

---

## 13. Mobile first (the priority)

Most of DocuMorph's customers are on phones, many on mid-range Android devices over mobile data. This section
is the design and build plan for that experience. It is specific to the product's sixteen addresses and its
editor; the desktop layout is derived from it, not the other way round.

### 13.1 The present mobile state, with evidence

**`v2` (the base)**

| Aspect | As found |
| --- | --- |
| Viewport | The framework default, `width=device-width, initial-scale=1` (confirmed in the built `/index.html`). `src/app/layout.tsx:22-27` sets only theme colours. No `viewport-fit=cover` |
| Safe-area insets | None: no `env(safe-area-inset-*)` anywhere in `src/` |
| Breakpoints | Tailwind's defaults only: `sm` 640 px (for example `src/components/Header.tsx:41`), `md` 768 px (`src/tools/OrganisePdf.tsx:91`), `lg` 1024 px (`src/app/page.tsx:72`, `src/tools/editor/PdfEditor.tsx:301`). Nothing targets 360 to 430 px |
| Tap targets (computed from the classes) | Theme switch 36 px (`Header.tsx:27`); default button about 40 px high (`src/app/globals.css:75-76`); file-order buttons 32 px (`src/components/FileOrder.tsx:43-49`); Organise controls 28 px (`OrganisePdf.tsx:122`); editor tools about 36 × 28 px (`PdfEditor.tsx:299`); "Delete page" about 24 px high (`PdfEditor.tsx:459`); colour pickers 36 × 28 px (`PdfEditor.tsx:352`); move handle 16 × 20 px and resize handle 12 px (`src/tools/editor/EditorPage.tsx:150`, `:214`) |
| Text sizes | Inputs and buttons 14 px (`globals.css:76`, `:108`); hints 12 px (`src/components/Dropzone.tsx:85`); much secondary text 14 px |
| Fixed and sticky elements | Header: sticky, 56 px, translucent with blur (`Header.tsx:35-36`). Editor toolbar: sticky below the header, wraps to several rows (`PdfEditor.tsx:289-290`). Organise bar: sticky below the header (`OrganisePdf.tsx:77`). Nothing is fixed to the bottom. `#tools` has `scroll-mt-20` so the header does not cover it (`src/app/page.tsx:65`) |
| Input types | Width, height and target size: `inputMode="numeric"` only (`src/tools/ImageTool.tsx:106`, `:110`, `:138`). Pages per file and font size: `type="number"` (`src/tools/SplitPdf.tsx:89`, `PdfEditor.tsx:337`). Page ranges and PDF form fields: plain text (`SplitPdf.tsx:83`, `src/tools/PdfToImages.tsx:88`, `PdfEditor.tsx:431`). No `autocomplete`, `enterkeyhint`, `autocapitalize` or `pattern` anywhere |
| File inputs | `accept` is a list of MIME types for PDFs and images and a list of extensions for Office files (`Dropzone.tsx:40`, `:90`); images also at `PdfEditor.tsx:376` and `src/tools/editor/SignaturePad.tsx:217`. No `capture` |
| Touch handling | Editor pages and the signature pad are `touch-none` (`EditorPage.tsx:130`, `SignaturePad.tsx:162`); pointer events without cancel handling; file reordering by HTML drag events (`FileOrder.tsx:24-33`) |
| Themes | Light and dark both exist, follow the device and can be switched by hand (`globals.css:4-33`, `Header.tsx:15-31`, `layout.tsx:29`) |
| Height | `min-h-dvh` on the body (`layout.tsx:37`), which is correct for mobile browser bars |

**`main` (the live site)**, for comparison: viewport `width=device-width, initial-scale=1.0`
(`main:index.html:13`); breakpoints at 768, 480 and 360 px (`main:assets/css/styles.css:1417`, `:1506`,
`:1581`); a 30 × 20 px menu button (`main:assets/css/styles.css:285-290`); text measured at 10.88 px at 360 px
wide (section 4.2); `type="number"` and `type="email"` inputs with no `inputmode` or `autocomplete`
(`main:index.html:294`, `:333`, `:344`, `:821`); a fixed full-screen menu and a sticky header
(`main:assets/css/styles.css:230`, `:320`); light and dark by device setting only (`main:index.html:15`).

**What must change:** every High item in section 5.1. In short — the editor must scroll, zoom and be operable
with a thumb; controls must be 44 px and text 16 px; actions must move to the bottom; uploads must show
progress and survive a poor connection; and saving must work wherever the link was opened.

### 13.2 Layouts: 360, 390 and 430 px first

- Every screen is drawn and built at **360 px** (small Android), **390 px** (current iPhone) and **430 px**
  (large phone) before any wider breakpoint is written. Styles are written mobile-first: the base rule is the
  phone, and `sm:`, `md:`, `lg:` add to it.
- One column, 16 px side padding, no element wider than the viewport. Long file names truncate in the middle
  so the extension stays visible. Tables do not occur; figures are rows of label and value.
- From 640 px, padding grows to 24 px; from 768 px, lists gain a second column; from 1024 px, tool pages gain
  the side panel and the editor gains its desktop toolbar with text labels.
- **No horizontal scroll at any width from 320 px upwards**, checked by a Playwright assertion on every page
  (`document.documentElement.scrollWidth <= clientWidth`).

### 13.3 Thumb reach and tap targets

- **Bottom action bar.** On screens below 768 px, once a file is chosen, the primary action of every tool
  ("Merge 3 PDFs", "Split PDF", "Save PDF", "Convert to PDF", "Compress") sits in a bar fixed to the bottom:
  48 px button, full width or sharing the row with one secondary action, with
  `padding-bottom: max(12px, env(safe-area-inset-bottom))`. While work is in progress the bar shows the
  progress and "Cancel"; when it is done, "Save" (and "Share" where available) and "Start again".
- **Tool navigation.** A "Tools" button in the header opens a bottom sheet listing the fourteen tools in their
  four groups, each row 56 px, the current one marked. This restores what NAV-03, NAV-05 and NAV-06 did on
  `main`, in thumb reach. A permanent bottom tab bar was considered and rejected: fourteen destinations do not
  fit one, and the bottom edge is needed for the action bar.
- **Editor.** Tools are in a bottom bar; section 13.8.
- **Targets.** Every interactive element has a hit area of at least 44 × 44 px with at least 8 px between
  neighbouring targets. Where the visible control is smaller (a 12 px resize handle), an invisible 44 px hit
  area surrounds it. Radio buttons and tick boxes are full-width rows at least 44 px tall. A Playwright check
  measures every button, link and input on every page at 390 px and fails below 44 px.
- **Organise pages.** Five 28 px buttons under each thumbnail are replaced by: tap a page to select it, then
  act from the bottom bar (Rotate left, Rotate right, Delete, Move earlier, Move later), plus press-and-drag to
  reorder. Two thumbnails per row at 360 px.

### 13.4 Type, line length and scrolling

- Body text, labels, inputs, selects and button labels are **16 px** at every width (section 7.3). The
  smallest text anywhere is 13 px, and only for non-essential meta. Nothing requires zooming to read, and no
  input causes iOS to zoom.
- Running text (privacy, Terms, explanations) is capped at 68 characters a line and has 24 px line height.
- Zooming by the visitor is never disabled: no `maximum-scale` or `user-scalable=no`.
- The page scrolls vertically only. Inside the editor, the page surface handles its own two-finger pan and
  zoom, and one-finger vertical scrolling passes through to the document (section 13.8).

### 13.5 Sticky bars and safe areas

- `viewport-fit=cover` is added through the `viewport` export in `src/app/layout.tsx`, and every fixed or
  sticky bar pads itself with `env(safe-area-inset-top|bottom|left|right)`, so nothing sits under a notch, a
  rounded corner or the home indicator, in portrait or landscape.
- The header is solid (no blur), 56 px, and is the only sticky element at the top. The editor's top bar
  replaces it while a PDF is open, so two bars never stack.
- Whenever a bottom bar is present, the page's content gets matching bottom padding, so the last row, an error
  message or the footer is never covered. Anchor targets and focused fields are kept clear of the bars with
  `scroll-margin` and `scroll-padding`.
- When the on-screen keyboard is open, the bottom action bar is hidden and sheets position themselves from
  `window.visualViewport`, so the field being typed in is always visible.
- A Playwright check scrolls every page to its end at 360 px and asserts that the last interactive element is
  not overlapped by a fixed element.

### 13.6 Forms: the right keyboard, autofill and inline validation

Every field of the product, and the attributes it takes. All are 16 px, have a visible label, and validate as
the person types or on leaving the field, with the message directly beneath, tied to the field by
`aria-describedby`.

| Field (where) | Attributes | Validation shown inline |
| --- | --- | --- |
| Width, Height in pixels (Resize image) | `type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="next"` / `"done"` | "Enter a width or a height"; whole numbers from 1 to 20,000 |
| Scale and Quality (image tools) | A slider with 44 px thumb plus − and + buttons; the value shown in mono | — |
| Largest size per image, KB (Compress image) | `type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" enterkeyhint="done"`, with a KB/MB choice (restoring CMP-06) | Minimum 5 KB; says when a target cannot be reached |
| Output format, Resolution, Quality preset (selects) | Native `<select>`, 16 px, 44 px tall — the phone's own picker | — |
| Page ranges (Split PDF, PDF to images) | `type="text" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"` — the numeric keypad on iOS has no comma or hyphen, so the text keyboard is used, with "–" and "," buttons above it; tapping thumbnails fills the field | The existing messages (`src/lib/ranges.ts:10-20`), shown while typing |
| Pages per file (Split PDF) | A − / + stepper with `inputmode="numeric"` | 1 to the page count |
| Text on the page (Editor) | A `<textarea>` in the text sheet: 16 px, `autocapitalize="sentences" spellcheck="true" enterkeyhint="enter"` | — |
| Font size (Editor) | A − / + stepper, 6 to 96 pt, `inputmode="numeric"` | Clamped, with the limit stated |
| Text and box colour (Editor) | Eight swatches of 44 px, with the system colour picker behind "More" | — |
| Typed signature name (Editor) | `type="text" autocomplete="name" autocapitalize="words" spellcheck="false" enterkeyhint="done"`; focus is not taken automatically | "Type your name first" |
| PDF form fields (Editor) | Text: `type="text" enterkeyhint="next"`, labelled by the field's readable name where the PDF gives one. Multi-line: `<textarea>`. Choices: native `<select>`. Tick boxes: 44 px rows | — |
| File pickers | PDF: `accept="application/pdf,.pdf"`. Images: `accept="image/jpeg,image/png,image/webp,image/heic,image/heif"` (HEIC converted on the device or explained; behaviour confirmed on an iPhone). Word: `.docx,.doc` plus their two MIME types. Excel: `.xlsx,.xls` plus theirs. `multiple` where several are allowed. `capture="environment"` only on the separate "Take a photo" button (D15) | Refusals name the file and say what is accepted |
| Feedback, if D1: category | Native `<select>` | — |
| Feedback, if D1: e-mail (optional) | `type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" enterkeyhint="next"` | "This does not look like an e-mail address", on leaving the field |
| Feedback, if D1: message | `<textarea required autocapitalize="sentences" enterkeyhint="enter" maxlength="2000">` with a count | "Write a message first" |
| Donation address, if D2 | Read-only text in mono with a full-width "Copy" button; no keyboard is raised | "Copied" announced |

### 13.7 Fast on a mid-range Android over mobile data

**Targets** (Lighthouse mobile, with its default throttling, against the Vercel preview, on every address):
Performance, Accessibility, Best Practices and SEO each **90 or higher**; **LCP under 2.5 s**; **CLS under
0.1**; **INP under 200 ms** (INP is measured in the Playwright phone project with CPU throttling, including
while a pointer is drawing in the editor, because Lighthouse does not interact).

**Budgets**, enforced in continuous integration from phase 6. Today's uncompressed figures are in section 4.1;
compressed sizes have not been measured and are the first thing measured in phase 0.

| Resource | Budget |
| --- | --- |
| JavaScript needed to show any page before a file is chosen | 170 KB compressed at most |
| PDF code (`pdf-lib`, `pdf.js`) | Not in the first load. Fetched when a file is chosen or the tool is clearly about to be used; the editor's own code 450 KB compressed at most, the worker cached after first use |
| CSS | 15 KB compressed at most, one file |
| Fonts | Two files preloaded at most, 60 KB together at most (today 52 KB); `font-display: swap`; the Noto Sans fallback served as WOFF2 and only on demand |
| Images | None in the shell: logo and icons are inline SVG. Share images under 200 KB each. Page previews are drawn on the device |
| Total transfer for a first visit to `/` | 250 KB at most |
| Requests to other origins | None, except the conversion itself on the five server tools |

**Uploads and failures on mobile data** (the five server tools):

- Real progress as a percentage and a bar, from an upload that reports it; then an honest "Converting…" state.
- "Cancel" at any time. A time limit in the browser with a message that says what happened.
- If the connection drops: "You are offline. Your file is still here — try again when you are connected." The
  chosen file and options are kept; "Try again" resends without picking the file again.
- The 4 MB limit (or the limit D3 sets) is stated before the file is chosen, and a file that is too large is
  refused immediately on the device, with the device tools that might help named in the message.
- The day's remaining allowance is shown, and a failed conversion does not use it (BUG-V2).

**Large files and memory** (the nine device tools):

- Limits adapt to the device. Above a size where a phone is likely to struggle (to be set from tests on the
  mid-range Android; provisionally 25 MB for a PDF and 24 megapixels for an image) the person is warned before
  starting, not after a crash. The 100 MB ceiling remains for capable devices.
- One copy of the file is held; pages that scroll away are released; canvases are capped to what the browser
  can allocate, scaling down with a note rather than failing.
- Long jobs show "Page 3 of 12" with a real bar and can be cancelled.

### 13.8 Touch patterns for this product

**Picking a file on a phone**

- The primary control is a full-width 48 px button that opens the phone's own picker, which offers the Files
  app or file manager and, for images, the photo library and camera. "Drop it here" wording appears only on
  devices with a fine pointer.
- "Images to PDF" has two buttons: "Choose images" and "Take a photo" (D15), so paper can be photographed page
  by page and each new photograph joins the list.
- iPhone photographs in HEIC are either accepted and converted on the device or refused with a sentence that
  says how to proceed; which, depends on what the test phones show (MOB-14).
- Reordering files is by press-and-drag on a 44 px handle, with "Move up" and "Move down" as the accessible
  alternative; the list scrolls automatically near its edges.

**The PDF editor on a phone**

- **The screen.** While a PDF is open the site header gives way to a slim top bar: Close, the page indicator
  ("3 / 12"), Undo, Redo and Save — each 44 px. The page takes all the space between it and the bottom tool
  bar. The form panel, when the PDF has one, is a sheet opened from a "Form" button, not a block above the
  pages.
- **Gestures.** One finger on the page scrolls the document. Two fingers pinch to zoom and pan, from "fit
  width" up to 400 %, and a double tap toggles between fit and 200 %; the page is re-rendered sharply at the
  new size. A tool draws only when it has been armed from the tool bar, and only with one finger; a second
  finger at any moment cancels the stroke and becomes a pan. After one use the tool disarms and the surface
  scrolls again (a "keep using" toggle is available on the armed tool). Cancelled touches are handled. This
  resolves MOB-01, MOB-02 and MOB-09.
- **The tool palette.** A bottom bar within thumb reach, 56 px plus the safe-area inset, with five labelled
  tools — Text, Sign, Cover, Highlight, More (Box, Image) — and the armed tool clearly marked, with a one-line
  hint above the bar ("Tap where the text should start").
- **Text entry.** Tapping the page with the Text tool drops a marker and opens a sheet that sits directly
  above the keyboard, positioned from `visualViewport`: a 16 px text area, with size (− / +), bold, colour
  swatches and font beside it. The page scrolls so the marker stays visible above the sheet, and the text
  appears on the page as it is typed. "Done" closes the keyboard and leaves the text selected. The on-screen
  keyboard therefore never covers what is being written, and iOS never zooms.
- **Selecting, moving, resizing.** A tap selects; the selection has 44 px hit areas on its corners and can be
  dragged directly. A small bar above the selection offers Edit, Delete and, for images, "Free resize" (the
  touch equivalent of holding Shift). Arrow keys and a "Position" control give the same without a pointer.
- **Signatures drawn by finger.** A full-width sheet, at least 220 px tall in portrait and using the whole
  width in landscape, with a baseline to sign on. Strokes are recorded as points and smoothed, so the sheet
  can be rotated or resized without distortion; lifting the finger never loses a stroke. "Clear" and "Use
  signature" are at the bottom, 48 px. The typed alternative uses one bundled script face so it looks the same
  on every phone. The signature can be kept for the rest of the visit to sign several places; it is not
  stored.
- **Page navigation.** The page indicator opens a sheet of thumbnails for jumping to a page; "Delete page" is
  there and under each page's header, at 44 px.
- **Undo and redo.** Always visible in the top bar, 44 px, with the 100-step history `v2` already has. The
  keyboard shortcuts remain for tablets with keyboards.
- **Saving and downloading.** "Save" writes the PDF on the device and then offers, according to what the
  browser supports: "Share" (the system share sheet, which on a phone includes Save to Files, WhatsApp and
  e-mail) and "Download". On iOS Safari and Android Chrome both are verified on real devices: the file must
  arrive with its proper name and open. Inside an in-app browser that cannot save files, a notice says so and
  offers "Open in your browser". Server conversions are downloaded from the site's own origin so the name is
  kept (BUG-V3).
- **Not losing work.** Unfinished edits are kept on the device (D14) and offered back if the tab was
  discarded; Close asks for confirmation in the project's own dialog.

### 13.9 Light and dark

Both themes exist in `v2` and are kept. Every screen and state in the checklist below is checked in both; the
PDF page itself stays white in dark mode, as paper, with the surroundings dimmed; the browser's theme colour
follows the theme (`src/app/layout.tsx:22-27`), including after the manual switch.

### 13.10 Page-by-page mobile checklist

Each address is checked at 360, 390 and 430 px, in light and dark, on an iPhone (Safari) and a mid-range
Android (Chrome). The common entries apply to every page; the entries beneath are specific.

**Every page**

- [ ] No horizontal scroll; nothing clipped; nothing under the notch or home indicator.
- [ ] Body text 16 px; nothing under 13 px; every target at least 44 px with 8 px spacing.
- [ ] Header 56 px, solid; "Tools" opens the tool sheet; theme switch works and is remembered.
- [ ] Focus is visible; the page can be used with a keyboard and with VoiceOver and TalkBack.
- [ ] Footer links reachable and not covered by any bar.
- [ ] Lighthouse mobile 90+ in all four categories.

**`/` — home (SHL-01, SHL-02, NAV-01)**

- [ ] The first tool row is visible without scrolling at 360 × 640.
- [ ] Fourteen rows in four groups, each at least 56 px; server tools tagged.
- [ ] The whole row is the link; pressed state visible.

**`/edit-pdf` (EDT-01 to EDT-23)**

- [ ] "Choose a PDF" opens the phone's picker; a 20-page PDF opens and the first page is sharp.
- [ ] One finger scrolls; two fingers zoom and pan; double tap zooms.
- [ ] Each tool can be armed from the bottom bar and used with one thumb.
- [ ] Typing: the sheet stays above the keyboard; the text is visible on the page; no page zoom on focus.
- [ ] Text with Yoruba tone marks saves correctly (EDT-20).
- [ ] An item can be selected, moved, resized and deleted by touch.
- [ ] A signature can be drawn in portrait and in landscape, placed, and placed again on another page.
- [ ] A typed signature looks the same on both phones.
- [ ] Form fields can be filled with the right keyboards and locked on saving.
- [ ] A page can be deleted and restored; the navigator jumps to a page.
- [ ] Undo and redo work across ten mixed actions.
- [ ] Save produces `<name>-edited.pdf`; it opens correctly in the phone's PDF viewer; Share reaches Files.
- [ ] Switching to another app and back keeps the work; a discarded tab offers the draft back.
- [ ] A password-protected PDF and a damaged PDF give their sentences.

**`/merge-pdf` (MRG-01 to MRG-03, MGX-01, MGX-02)**

- [ ] Several PDFs can be picked at once and more added.
- [ ] Order can be changed by dragging with a finger and by the buttons; a file can be removed.
- [ ] "Merge N PDFs" in the bottom bar; disabled with the reason until there are two.
- [ ] Result saves as `merged.pdf` and opens.

**`/split-pdf` (SPL-01 to SPL-04)**

- [ ] The three ways of splitting are 44 px rows.
- [ ] Ranges can be typed with the helper keys; mistakes are explained beneath the field as they are typed.
- [ ] Several results are listed; "Save all as .zip" and "Share" work.

**`/organise-pdf` (ORG-01 to ORG-05)**

- [ ] Two thumbnails per row at 360 px, drawn as they scroll into view.
- [ ] Tap selects; rotate, delete and move from the bottom bar; drag to reorder.
- [ ] The count of pages kept and "Save PDF" are in the bottom bar and never cover the last row.

**`/images-to-pdf` (I2P-01, I2P-02)**

- [ ] "Choose images" offers the photo library; "Take a photo" opens the camera (D15).
- [ ] An iPhone HEIC photograph is handled as section 13.8 says.
- [ ] Order by drag; page size as three 44 px rows; ten 12-megapixel photographs complete without the tab being discarded.

**`/pdf-to-images` (P2I-01, P2I-02)**

- [ ] Format and resolution use the phone's pickers; 300 dpi on a large page scales down with a note instead of failing.
- [ ] "Page k of n" with a bar; cancel works.
- [ ] Results list; zip and Share.

**`/convert-image`, `/resize-image`, `/compress-image` (CNV-06, CNV-07, RSZ-01 to RSZ-05, CMP-02 to CMP-09, IMG-01 to IMG-06)**

- [ ] Several photographs from the library at once.
- [ ] Numeric keypad for pixels and size; sliders usable with a thumb, with − and + buttons.
- [ ] Dimensions shown before and after (RSZ-04, RSZ-05); sizes before and after with the saving.
- [ ] A photograph taken in portrait stays upright (IMG-06).
- [ ] The action is in the bottom bar and the options do not push it off screen.

**`/word-to-pdf`, `/pdf-to-word`, `/excel-to-pdf`, `/pdf-to-excel`, `/compress-pdf` (CNV-02 to CNV-05, CMP-01, CMP-04, SRV-01 to SRV-03, FLW-11, FLW-12, FLW-20)**

- [ ] "Sent to ConvertAPI" is stated in 16 px text above the picker, with the size limit.
- [ ] Android's picker shows Word and Excel files as selectable.
- [ ] Upload shows a percentage; "Cancel" works; switching to aeroplane mode mid-upload gives the offline message and keeps the file.
- [ ] The result downloads with its proper name on both phones and is then deleted from the server.
- [ ] Remaining conversions for the day are shown; the limit message is clear.

**`/privacy` (LGL-02), and `/terms` if D4 (LGL-01)**

- [ ] One column of at most 68 characters; headings in order; a date; links 44 px tall.

**Signature, text and tool sheets; dialogs**

- [ ] Open from the bottom, respect the safe area, close by button, by swipe down and by the back gesture on Android; focus returns to where it was.

**Not found and error pages**

- [ ] One sentence and a 44 px link back to the tools.

**Feedback (D1) and Donate (D2), if restored**

- [ ] Feedback: e-mail keyboard and autofill for the address; inline validation; sending, sent and failed states; the keyboard does not cover "Send".
- [ ] Donate: the QR code is at least 200 px and scannable from another phone; "Copy" confirms; long addresses wrap in mono without overflowing.

---

## 14. Quality gates (must all pass before the PR)

**Nothing is called done until every one of these passes.** A gate that fails is fixed at its cause; it is
never switched off, loosened or worked around. The pull request states the result of each gate.

| Gate | How it is checked in this repository | What counts as a pass |
| --- | --- | --- |
| **(a) Type check and lint clean** | `npm run typecheck` (`tsc --noEmit -p .`) and `npm run lint` (`eslint --max-warnings 0`), locally and in CI. A search of the diff for `any`, `ts-ignore`, `ts-expect-error`, `ts-nocheck`, `eslint-disable`, `as unknown as` and non-null `!` | 0 errors and 0 warnings from both. The search finds nothing. `tsconfig.json` and `eslint.config.mjs` are no looser than `v2`'s, apart from the single recorded exclusion of the generated PDF worker if the bundler route is not possible. Today: type check passes; lint fails (section 4.1) |
| **(b) Tests for every rule, fix and key flow** | `npm test` (Vitest) and `npx playwright test` with two projects: **phone** (390 × 844, touch, mobile user agent) and **desktop** (1280 × 800). ConvertAPI is stubbed. | All pass on both projects. Every problem in section 5 that is fixed has a test that fails without the fix. The 26 existing tests still pass. Flows covered, each on phone and desktop: (1) open the tool list and reach each of the fourteen tools; (2) edit a PDF — add text, cover and retype, highlight, place an image, undo, redo, save, and re-open the saved file to confirm the content; (3) sign a PDF with a drawn signature using touch events; (4) fill and lock a form; (5) merge three PDFs after reordering; (6) split by ranges, including a mistyped range; (7) organise — rotate, delete, reorder, save; (8) images to PDF; (9) PDF to images with a zip; (10) convert, resize and compress images, including a target size that cannot be met; (11) each server tool — success, wrong file type, too large, limit reached, connection lost, cancel, and deletion afterwards; (12) refusal of a renamed file; (13) theme switch and its persistence; (14) privacy page and not-found page; (15) feedback and donation flows if restored. Unit tests cover the route handler (every status in APX-04), the environment schema, the rate limit, and the editor's state and history |
| **(c) Production build** | `npm run build` in CI with no environment variables set, and again on a Vercel preview | Exit 0, no warnings; all sixteen pages generated; bundle budgets of section 13.7 met |
| **(d) Data and secret safety** | A search of the built client files in `.next/static` for `CONVERTAPI`, `UPSTASH` and any other server variable name; a check that only `NEXT_PUBLIC_SITE_URL` carries the public prefix. Route tests for validation and limits. A Playwright network log asserting that the nine device tools send no file bytes and contact no other origin. `curl -I` on the preview. `npm audit --omit=dev`. A scan of the Git history of the branch for secret patterns | No server variable name or value in any client file. Every request to `/api/*` is validated by a zod schema on the server and rate-limited; anything unlisted is refused. Headers present: Content-Security-Policy, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame protection. 0 audit findings in shipped packages. No secret in history. There are no accounts, so "auth" here means: no route trusts the browser, and the delete call is tied to the visitor who made the file |
| **(e) Seen on screen** | Playwright screenshots of every page and every state (empty, file chosen, working, done, error; each editor sheet) at **360, 390, 768, 1024, 1280 and 1536 px**, in **light and dark**, compared by eye against section 7 and section 13. Matching screenshots of `v2` at the same widths, taken at the start of phase 1, are the "before" | Every screenshot reviewed, phone widths first. No horizontal scroll, clipping, overlap or covered content. Before and after pairs are in the pull request, phone first. The contrast table of section 7.2 is re-computed from the shipped tokens and every pair passes |
| **(f) Independent review** | A review of the finished diff by a reviewer who did not write it (a separate review session and, where available, a person), looking for real defects: security, privacy, data loss, broken flows, memory on phones | Every finding is fixed, or shown with evidence not to be a defect, and re-checked by the reviewer. The findings and their resolutions are listed in the pull request |
| **(g) The professional finish** | A check of every screen against the design rules of section 11 (no gradients, glows, glass, emoji, stock layout; one icon set; one radius scale). A read-through of every string in the interface, the README and the legal pages. A search for the banned words of section 11 and for American spellings (`color` in copy, `organize`, `center`, `optimize`, `license` as a noun) outside code identifiers | No rule broken. Copy is plain, specific and in British English. No placeholder text or images anywhere |
| **(h) Lighthouse mobile** | Lighthouse (mobile, default throttling) against the Vercel preview for all sixteen addresses, three runs each, median taken; the editor additionally profiled with a PDF open in the Playwright phone project | **90 or higher in Performance, Accessibility, Best Practices and SEO on every address**; LCP under 2.5 s; CLS under 0.1; INP under 200 ms in the interaction tests. The scores are in the pull request. Earlier indicative figures: section 4.1 |
| **(i) The owner's approval** | The pull request from `rebuild/production`, with the gate results, screenshots, scores, the ticked 151-item checklist and the list of owner decisions applied | The owner approves in writing. Nothing is merged, and nothing is deployed to the live site, before that. `main` and `v2` are untouched until then |

In addition, before the pull request: the page-by-page checklist of section 13.10 is completed on a real
iPhone and a real mid-range Android phone, and one live conversion per server tool is run on the preview
(section 8.2).

---

## 15. What will make it stand out

**What similar products typically do.** DocuMorph's competitors are of three kinds. (1) The large online PDF
suites: as a rule they process files on their own servers, limit free use by number of tasks or file size, and
keep some tools behind a subscription or an account. (2) Native phone apps for scanning and editing PDFs,
which need installing, commonly carry advertising or a subscription, and take storage. (3) The editing
features built into phones and desktop viewers, which are private and free but limited — they do not merge,
split, compress or convert Office files. These are descriptions of the category as generally observed, not
measured claims about any named product; nothing on the site will make a comparative claim about a named
competitor unless it has been checked on the day.

Against that background, five things the rebuild can deliver and prove:

1. **A PDF editor that is properly usable on a phone, in the browser.** Signing a document or filling a form
   with one thumb — bottom tools, a text sheet that stays above the keyboard, a signature pad made for a
   finger, pinch to zoom — without installing anything. *Proof:* the touch-driven tests of section 14 (b),
   the checklist of section 13.10 completed on two real phones, and INP under 200 ms.

2. **The file does not leave the phone, and the site shows it.** Nine of the fourteen tools do all their work
   on the device (`src/lib/tools.ts:17-25`). Every tool says where the file is processed before the file is
   chosen, and the five that need a server say so in plain 16 px text, delete the result afterwards and show
   the day's allowance. *Proof:* the automated network check of section 14 (d) — no file bytes sent and no
   other origin contacted by the device tools — which can be published on the privacy page as a statement of
   fact.

3. **Light on data and quick on an ordinary phone.** No advertising, no trackers, no third-party scripts, a
   first visit of 250 KB at most, and PDF code fetched only when a file is chosen. *Proof:* the budgets of
   section 13.7 enforced in CI and Lighthouse mobile 90+ on every address.

4. **Works on a poor connection, and without one.** If the owner agrees (D11), the nine device tools work
   offline after the first visit and the site can be added to the home screen; uploads for the server tools
   show progress, can be cancelled and can be retried without choosing the file again; unfinished edits
   survive the phone discarding the tab (D14). *Proof:* Playwright runs of the device tools with the network
   switched off, and the aeroplane-mode entries of section 13.10.

5. **No account, no watermark, no surprises — and it writes more than English.** Nothing in the code adds a
   watermark or asks for a sign-up; limits are stated before the person starts, not after. Text added to a PDF
   can use characters outside the standard PDF fonts, such as Yoruba tone marks, through the bundled fallback
   font (`src/lib/pdf/ops.ts:202-213`, tested at `src/lib/__tests__/pdf.test.ts:83`). *Proof:* the saved-file
   tests, and a read-through of every limit message.

None of these depends on a claim that cannot be demonstrated from the repository or the preview deployment.

---

**No rebuild work will start until the owner approves this plan.**
