# DocuMorph

A **privacy-first file tools web app** for quick utilities like **Convert, Compress, Resize, and Merge** — with a smooth **upload → process → download** experience.

---

## ✨ Features

### File Tools

- **Convert** — Word ↔ PDF, Excel ↔ PDF, JPG ↔ PNG
- **Compress** — PDFs & Images (auto quality or target size)
- **Resize** — Images by width/height or scale percentage
- **Merge** — Combine multiple PDFs into one

### User Experience

- **Drag & Drop** with strict file-type validation
- **Progress UI** — upload, processing, and success states
- **Daily usage limit** — stored locally on device
- **Mobile-first** — responsive design with mobile menu
- **iOS optimized** — native upload for all iOS versions

### Extras

- **Feedback modal** — submit requests via Formspree
- **Donation wallets** — securely loaded from server env vars

---

## 🛠 Tech Stack

| Layer          | Technology                             |
| -------------- | -------------------------------------- |
| **Frontend**   | HTML, CSS, Vanilla JavaScript          |
| **Storage**    | Vercel Blob (with iOS-native fallback) |
| **Processing** | ConvertAPI                             |
| **Backend**    | Vercel Serverless Functions            |
| **Deployment** | Vercel                                 |

---

## 📂 Project Structure

```
DocuMorph/
├── index.html              # Single-page app UI
├── package.json            # Dependencies & scripts
├── README.md
│
├── assets/
│   ├── css/
│   │   └── styles.css      # All styles (responsive + glass UI)
│   └── js/
│       └── scripts.js      # App logic, uploads, state management
│
└── api/
    ├── blob-upload.js      # Vercel Blob client upload (non-iOS)
    ├── native-upload.js    # FormData upload for iOS devices
    ├── convert.js          # ConvertAPI proxy (URL mode)
    ├── form.js             # Formspree proxy for feedback
    └── wallets.js          # Donation wallet addresses from ENV
```

---

## ⚙️ How It Works

DocuMorph uses a **URL-based pipeline** to avoid serverless upload limits:

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Browser   │────▶│   Vercel Blob    │────▶│ ConvertAPI  │
│  (Upload)   │     │  (File Storage)  │     │ (Process)   │
└─────────────┘     └──────────────────┘     └─────────────┘
                              │                      │
                              ▼                      ▼
                         Blob URL ──────────▶ Processed File URL
                                                     │
                                                     ▼
                                              ┌─────────────┐
                                              │  Download   │
                                              └─────────────┘
```

1. **Upload** — Browser uploads file to Vercel Blob via `/api/blob-upload` (or `/api/native-upload` on iOS)
2. **Process** — App sends the Blob URL to `/api/convert`
3. **Convert** — Server calls ConvertAPI with the URL, returns processed file
4. **Download** — UI shows download button for the final output

> 🔒 Your ConvertAPI secret stays on the server (never exposed in browser)

---

## 🔑 Environment Variables

Required on Vercel:

```env
CONVERTAPI_SECRET=your_convertapi_secret
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
FORMSPREE_FORM_ID=your_formspree_id

# Donation wallets (optional)
WALLET_BTC=...
WALLET_ETH=...
WALLET_SOL=...
# ... etc
```

---

## 🚀 Deployment

1. Push to GitHub
2. Connect repo to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

---

## 📱 iOS Compatibility

iOS devices use a **native upload path** to ensure reliability:

- Uses `XMLHttpRequest` + `FormData` instead of `@vercel/blob` client
- Server-side `busboy` parses the upload
- Direct `put()` to Vercel Blob from server
- Works on iOS 12+ through current and future versions

---

## 👤 Author

**Samson Eniolorunda**

---

## 📄 License

MIT License — free to use, modify, and distribute.
