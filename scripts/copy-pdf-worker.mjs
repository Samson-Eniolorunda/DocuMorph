// Copies the pdf.js worker into public/ so the browser can load it from the
// same origin (no CDN, works offline and with a strict policy).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const src = join(dirname(require.resolve("pdfjs-dist/package.json")), "build", "pdf.worker.min.mjs");
if (!existsSync(src)) {
  console.error("pdf.js worker not found at", src);
  process.exit(1);
}
mkdirSync("public", { recursive: true });
copyFileSync(src, join("public", "pdf.worker.min.mjs"));
console.log("Copied pdf.js worker to public/");
