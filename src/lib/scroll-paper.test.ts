import { expect, it } from "vitest";
import { createPaperGeometry, paintingWindow } from "./scroll-paper";

it("creates a watertight sheet with every edge shared by exactly two triangles", () => {
  const geometry = createPaperGeometry(8, 4);
  const index = geometry.index!;
  const edges = new Map<string, number>();
  for (let i = 0; i < index.count; i += 3) {
    const t = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    for (let j = 0; j < 3; j++) {
      const a = t[j],
        b = t[(j + 1) % 3];
      const key = [Math.min(a, b), Math.max(a, b)].join(":");
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  expect([...edges.values()].every((count) => count === 2)).toBe(true);
  expect(geometry.groups).toHaveLength(2);
  expect(new Set(Array.from(geometry.attributes.paperSide.array))).toEqual(
    new Set([1, -1]),
  );
  geometry.dispose();
});
it("keeps a single undistorted painting window within the panorama across viewport ratios and large drags", () => {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
    [2560, 900],
  ])
    for (const pan of [-1e6, -800, 0, 800, 1e6]) {
      const crop = paintingWindow(w, h, pan);
      expect(crop.x).toBeGreaterThanOrEqual(0);
      expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.z).toBeLessThanOrEqual(1.000001);
      expect(crop.y + crop.w).toBeLessThanOrEqual(1.000001);
      expect((crop.z / crop.w) * 3).toBeCloseTo(w / h);
    }
  expect(paintingWindow(1440, 900, 400).x).toBeLessThan(
    paintingWindow(1440, 900, -400).x,
  );
});
