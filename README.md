# DocuMorph

DocuMorph is a **privacy-first file tools web app** for quick utilities like **Convert, Compress, Resize, and Merge** — with a smooth **upload → process → download** experience.

---

## Features

- **Convert** (Word ↔ PDF, Excel ↔ PDF, JPG ↔ PNG)
- **Compress** (PDF + Images)
- **Resize** (Images by width/height or scale %)
- **Merge** (Combine multiple PDFs into one)
- **Drag & Drop** + strict supported-file validation
- **Progress UI** (upload, processing, success states)
- **Daily usage limit** (local device storage)
- **Feedback & Requests** modal (submits via Formspree)
- **Donation wallets** (loaded securely from server env vars)

---

## Tech Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Storage:** Vercel Blob (mobile-safe uploads)
- **Processing:** ConvertAPI
- **Backend:** Vercel Serverless Functions (`/api/*`)
- **Deployment:** Vercel

---

## How it Works (Blob → ConvertAPI)

DocuMorph uses a URL-based pipeline to avoid serverless upload limits and reduce random mobile/WAF 403 issues:

1. The browser uploads the selected file to **Vercel Blob** via `/api/blob-upload`.
2. The app sends the resulting **Blob URL** (or multiple URLs for merge) to `/api/convert`.
3. `/api/convert` calls **ConvertAPI** using the URL(s) and returns a processed file URL.
4. The UI shows a **Download** button for the final output.

> Your ConvertAPI secret stays on the server (never exposed in the browser).

---

## Project Structure

```text
/
├─ index.html
├─ package.json
├─ assets/
│  ├─ css/
│  │  └─ styles.css
│  └─ js/
│     └─ scripts.js
└─ api/
   ├─ blob-upload.js   # Vercel Blob client upload route
   ├─ convert.js       # ConvertAPI proxy (URL mode + legacy multipart)
   ├─ form.js          # Formspree proxy for feedback submissions
   └─ wallets.js       # Donation wallet addresses from ENV
