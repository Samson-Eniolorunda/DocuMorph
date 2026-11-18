import { describe, expect, it } from "vitest";
import { detectKind } from "@/lib/files";
import { MAX_CANVAS_PIXELS, pixelScale } from "@/lib/limits";

describe("phone limits", () => {
  it("leaves a canvas within the limit alone", () => {
    expect(pixelScale(4000, 3000)).toBe(1);
  });

  it("scales an oversized canvas down to fit", () => {
    const scale = pixelScale(8000, 6000);
    expect(scale).toBeLessThan(1);
    expect(Math.floor(8000 * scale) * Math.floor(6000 * scale)).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
  });
});

describe("HEIC photographs", () => {
  const heic = (brand: string) =>
    new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, ...[...brand].map((c) => c.charCodeAt(0)), 0, 0, 0, 0]);
  it("are recognised by their brand so they can be explained", () => {
    expect(detectKind(heic("heic"))).toBe("heic");
    expect(detectKind(heic("mif1"))).toBe("heic");
  });
  it("are not mistaken for other ISO media", () => {
    expect(detectKind(heic("mp42"))).toBe("unknown");
  });
});
