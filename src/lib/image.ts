// Image work in the browser with a canvas: convert, resize and compress.

import { fitToSize } from "./target-size";

export type ImageType = "image/jpeg" | "image/png" | "image/webp";

export const EXT: Record<ImageType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function decode(file: Blob) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image could not be opened. It may be damaged or in a format this browser does not support.");
  }
}

export function draw(bitmap: ImageBitmap, width: number, height: number, type: ImageType) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d")!;
  // JPEG has no transparency: put transparent areas on white, not black.
  if (type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function encode(canvas: HTMLCanvasElement, type: ImageType, quality = 0.9) {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  if (!blob) throw new Error("This browser could not create the image.");
  // Browsers fall back to PNG for types they cannot write (older Safari and WebP).
  if (blob.type !== type) throw new Error(`This browser cannot save ${EXT[type].toUpperCase()} images. Choose another format.`);
  return blob;
}

/** Target size from width, height and "keep proportions". */
export function targetDimensions(src: { width: number; height: number }, want: { width?: number; height?: number; percent?: number }, keepRatio = true) {
  if (want.percent) return { width: Math.round((src.width * want.percent) / 100), height: Math.round((src.height * want.percent) / 100) };
  const r = src.width / src.height;
  let w = want.width || 0;
  let h = want.height || 0;
  if (keepRatio) {
    if (w && !h) h = w / r;
    else if (h && !w) w = h * r;
    else if (w && h) {
      // Fit inside the box without stretching.
      const s = Math.min(w / src.width, h / src.height);
      w = src.width * s;
      h = src.height * s;
    }
  }
  return { width: Math.max(1, Math.round(w || src.width)), height: Math.max(1, Math.round(h || src.height)) };
}

export async function compressToTarget(bitmap: ImageBitmap, type: ImageType, targetBytes: number) {
  const canvas = draw(bitmap, bitmap.width, bitmap.height, type);
  const first = await fitToSize((q) => encode(canvas, type, q), targetBytes);
  if (first.fits) return first;
  // Quality alone is not enough: shrink the image step by step and try again.
  let scale = 0.8;
  for (let i = 0; i < 6; i++, scale *= 0.8) {
    const smaller = draw(bitmap, bitmap.width * scale, bitmap.height * scale, type);
    const r = await fitToSize((q) => encode(smaller, type, q), targetBytes);
    if (r.fits) return r;
  }
  return first;
}
