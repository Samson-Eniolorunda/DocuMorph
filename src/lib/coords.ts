// Converts positions on the page as people see it on screen into PDF
// coordinates, including pages that are stored rotated.
//
// Screen ("display") space: origin at the top-left of the page as shown,
// measured in PDF points (scale 1), y grows downwards.
// PDF space: origin at the bottom-left of the unrotated page, y grows upwards.

export interface PageGeometry {
  /** Unrotated page size in points (the crop box). */
  width: number;
  height: number;
  /** Lower-left corner of the crop box; usually 0, 0. */
  x0: number;
  y0: number;
  /** Clockwise rotation the viewer applies: 0, 90, 180 or 270. */
  rotation: number;
}

export const normaliseRotation = (r: number) => (((Math.round(r / 90) * 90) % 360) + 360) % 360;

/** Size of the page as it appears on screen. */
export function displaySize(p: PageGeometry) {
  const r = normaliseRotation(p.rotation);
  return r % 180 === 0 ? { width: p.width, height: p.height } : { width: p.height, height: p.width };
}

/** A point on the displayed page → the same point in PDF space. */
export function displayToPdf(p: PageGeometry, dx: number, dy: number) {
  const r = normaliseRotation(p.rotation);
  const { width: W, height: H, x0, y0 } = p;
  switch (r) {
    case 90:
      return { x: x0 + dy, y: y0 + dx };
    case 180:
      return { x: x0 + W - dx, y: y0 + dy };
    case 270:
      return { x: x0 + W - dy, y: y0 + H - dx };
    default:
      return { x: x0 + dx, y: y0 + H - dy };
  }
}

/**
 * Where to draw a box that appears at (dx, dy, w, h) on screen, upright.
 * pdf-lib draws boxes, images and text from their lower-left corner and turns
 * them anticlockwise by `rotate`; turning by the page rotation keeps them
 * upright for the reader.
 */
export function placeBox(p: PageGeometry, dx: number, dy: number, h: number) {
  const anchor = displayToPdf(p, dx, dy + h);
  return { x: anchor.x, y: anchor.y, rotate: normaliseRotation(p.rotation) };
}
