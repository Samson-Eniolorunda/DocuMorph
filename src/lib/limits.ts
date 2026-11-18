// Limits that adapt to the device, so a phone is warned before it struggles, not after it crashes.

import { MB, formatBytes } from "./files";

/** Above this, a phone is warned before a PDF is opened. */
export const PHONE_PDF_WARN_BYTES = 25 * MB;
/** Browsers on phones refuse canvases larger than about this many pixels (16,777,216 on iOS). */
export const MAX_CANVAS_PIXELS = 16_000_000;

export const isTouchDevice = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/** A warning for a large file on a touch device, or null. Files up to 100 MB are accepted; phones are told first. */
export function largeFileWarning(file: Blob) {
  if (!isTouchDevice() || file.size <= PHONE_PDF_WARN_BYTES) return null;
  return `This file is ${formatBytes(file.size)}. Large files can be slow on a phone and the browser may close the tab. Close other apps first, and save your work as you go.`;
}

export const largePdfWarning = largeFileWarning;

/** The factor (at most 1) that brings a canvas of this size within what a phone can allocate. */
export function pixelScale(width: number, height: number, maxPixels = MAX_CANVAS_PIXELS) {
  const pixels = width * height;
  return pixels > maxPixels ? Math.sqrt(maxPixels / pixels) : 1;
}

/** True inside the browsers built into social and chat apps, which often cannot save files. */
export function isInAppBrowser() {
  return (
    typeof navigator !== "undefined" &&
    /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|Twitter/i.test(navigator.userAgent)
  );
}
