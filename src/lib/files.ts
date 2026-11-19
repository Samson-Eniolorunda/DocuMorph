// File checks shared by the browser tools and the server route.
// The type is decided from the file's first bytes (its "signature"), not from
// its name, so a renamed file cannot pass as something it is not.

export type FileKind = "pdf" | "jpg" | "png" | "webp" | "heic" | "zip-office" | "ole-office" | "unknown";

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);

export function detectKind(head: Uint8Array): FileKind {
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (startsWith(head, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)) return "webp"; // RIFF....WEBP
  if (startsWith(head, [0x66, 0x74, 0x79, 0x70], 4)) {
    // ISO media: iPhone photographs saved as HEIC/HEIF.
    const brand = String.fromCharCode(...head.slice(8, 12));
    if (["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"].includes(brand)) return "heic";
  }
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) return "zip-office"; // .docx, .xlsx (ZIP container)
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole-office"; // .doc, .xls
  return "unknown";
}

/** Reads the first bytes of a browser File (or Blob) and detects its kind. */
export async function sniff(file: Blob): Promise<FileKind> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  return detectKind(head);
}

export const extOf = (name: string) => (name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "");

/** "Report.final.pdf" + "png" → "Report.final.png"; adds a suffix when asked. */
export function renameTo(name: string, ext: string, suffix = "") {
  const base = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  const clean = base.replace(/[\\/:*?"<>|]+/g, "-").trim() || "file";
  return `${clean}${suffix}.${ext}`;
}

export function formatBytes(n: number) {
  if (!Number.isFinite(n) || n < 0) return "–";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${Number((n / (1024 * 1024)).toFixed(1))} MB`;
}

/** Percentage saved, e.g. 1000 → 600 is 40. Negative when the file grew. */
export const savedPercent = (before: number, after: number) =>
  before > 0 ? Math.round((1 - after / before) * 100) : 0;

export const MB = 1024 * 1024;
/** Files processed on this device: limited only to keep phones responsive. */
export const DEVICE_MAX_BYTES = 100 * MB;
/** Files sent to the server: Vercel accepts request bodies up to 4.5 MB. */
export const SERVER_MAX_BYTES = 4 * MB;
/** Vercel refuses function responses over 4.5 MB; a result larger than this is declined before it is sent. */
export const SERVER_RESULT_MAX_BYTES = 4_500_000;
