/** The 2D drawing context of a canvas, or a plain error where the browser refuses to give one. */
export function context2d(canvas: HTMLCanvasElement | OffscreenCanvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser could not prepare a drawing surface. Close other tabs and try again.");
  return ctx as CanvasRenderingContext2D;
}
