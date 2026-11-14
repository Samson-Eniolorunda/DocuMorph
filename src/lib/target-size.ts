// Finds the highest quality whose encoded size fits a target, by binary
// search over quality (each step encodes the image once).

export interface Encoded {
  blob: Blob;
  quality: number;
}

export async function fitToSize(
  encode: (quality: number) => Promise<Blob>,
  targetBytes: number,
  { min = 0.05, max = 0.95, steps = 8 } = {},
): Promise<Encoded & { fits: boolean }> {
  let lo = min;
  let hi = max;
  let best: Encoded | null = null;
  let smallest: Encoded | null = null;

  for (let i = 0; i < steps; i++) {
    const q = (lo + hi) / 2;
    const blob = await encode(q);
    if (!smallest || blob.size < smallest.blob.size) smallest = { blob, quality: q };
    if (blob.size <= targetBytes) {
      best = { blob, quality: q };
      lo = q;
    } else {
      hi = q;
    }
  }
  if (best) return { ...best, fits: true };
  // Even the lowest quality tried is too big: return the smallest result.
  const floor = await encode(min);
  const pick = floor.size < (smallest?.blob.size ?? Infinity) ? { blob: floor, quality: min } : smallest!;
  return { ...pick, fits: pick.blob.size <= targetBytes };
}
