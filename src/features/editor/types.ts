import type { Edit, FontFamily } from "@/lib/pdf/ops";

/** An edit as the editor holds it: images also keep a preview address. */
export type EdEdit = Edit & { url?: string };

export type ToolName = "select" | "text" | "whiteout" | "highlight" | "outline" | "image" | "signature";

export interface TextStyle {
  size: number;
  color: string;
  font: FontFamily;
  bold: boolean;
}

/** Screen fonts that match the standard PDF fonts used when saving. */
export const CSS_FONT: Record<FontFamily, string> = {
  sans: "Helvetica, Arial, 'Liberation Sans', sans-serif",
  serif: "'Times New Roman', Times, 'Liberation Serif', serif",
  mono: "'Courier New', Courier, 'Liberation Mono', monospace",
};

let ctx: CanvasRenderingContext2D | null = null;

/**
 * Where the baseline of the first line sits below the top of a text box with
 * line height 1.2, as a share of the font size, for the screen font in use.
 * Passed to the export so saved text lands exactly where it was typed.
 */
export function baselineRatio(style: TextStyle) {
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return 0.95;
  ctx.font = `${style.bold ? "bold " : ""}100px ${CSS_FONT[style.font]}`;
  const m = ctx.measureText("Hg");
  const ascent = m.fontBoundingBoxAscent ?? 90;
  const descent = m.fontBoundingBoxDescent ?? 21;
  return ((120 - (ascent + descent)) / 2 + ascent) / 100;
}

/** Width in points of the longest line, measured with the matching screen font. */
export function measureText(text: string, style: TextStyle) {
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return { width: 100, height: style.size * 1.2 };
  ctx.font = `${style.bold ? "bold " : ""}${style.size}px ${CSS_FONT[style.font]}`;
  const lines = text.split("\n");
  const surface = ctx;
  const width = Math.max(...lines.map((l) => surface.measureText(l || " ").width));
  return { width, height: lines.length * style.size * 1.2 };
}
