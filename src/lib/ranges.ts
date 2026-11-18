// Page ranges typed by people: "1-3, 5, 8-" → groups of zero-based page indexes.

export type RangeResult = { ok: true; groups: number[][] } | { ok: false; error: string };

export function parseRanges(input: string, pageCount: number): RangeResult {
  const parts = input
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return { ok: false, error: "Enter at least one page or range, for example 1-3, 5." };

  const groups: number[][] = [];
  for (const part of parts) {
    const m = part.match(/^(\d+)?\s*(?:(-|–)\s*(\d+)?)?$/);
    if (!m || (!m[1] && !m[3])) return { ok: false, error: `"${part}" is not a page or a range.` };
    const from = m[1] ? Number(m[1]) : 1;
    const to = m[2] ? (m[3] ? Number(m[3]) : pageCount) : from;
    if (from < 1 || to < 1) return { ok: false, error: "Pages start at 1." };
    if (from > pageCount || to > pageCount)
      return { ok: false, error: `This document has ${pageCount} page${pageCount === 1 ? "" : "s"}.` };
    if (from > to) return { ok: false, error: `"${part}" runs backwards; write it as ${to}-${from}.` };
    groups.push(Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i));
  }
  return { ok: true, groups };
}

/** Splits a document into chunks of `size` pages: 7 pages by 3 → [0,1,2] [3,4,5] [6]. */
export function chunkPages(pageCount: number, size: number): number[][] {
  const n = Math.max(1, Math.floor(size));
  const out: number[][] = [];
  for (let i = 0; i < pageCount; i += n) out.push(Array.from({ length: Math.min(n, pageCount - i) }, (_, j) => i + j));
  return out;
}

/** Short label for a group, used in file names: [0,1,2] → "1-3", [4] → "5". */
export const groupLabel = (g: number[]) => {
  const first = (g[0] ?? 0) + 1;
  const last = (g[g.length - 1] ?? 0) + 1;
  return first === last ? `${first}` : `${first}-${last}`;
};

/** The pages (zero-based) named by a typed range, or none when the text is blank or not yet a valid range. */
export function pagesInRanges(input: string, pageCount: number): Set<number> {
  const parsed = parseRanges(input, pageCount);
  return new Set(parsed.ok ? parsed.groups.flat() : []);
}

/** Pages (zero-based) as the shortest typed ranges: [0, 1, 2, 4] gives "1-3, 5". */
export function rangesFromPages(pages: Iterable<number>): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (sorted[j + 1] === (sorted[j] ?? 0) + 1) j++;
    const from = (sorted[i] ?? 0) + 1;
    const to = (sorted[j] ?? 0) + 1;
    parts.push(from === to ? `${from}` : `${from}-${to}`);
    i = j + 1;
  }
  return parts.join(", ");
}
