import { expect, it } from "vitest";
import { createTimeRibbon, eventPoint, timePoint } from "./immersive-space";
it("event navigation advances monotonically into depth while following a curved route", () => {
  for (let i = 0; i < 30; i++) {
    expect(timePoint(i + 1).z).toBeLessThan(timePoint(i).z);
    expect(eventPoint(i).y).toBeGreaterThan(timePoint(i).y);
    expect(Math.abs(eventPoint(i).x - timePoint(i).x)).toBeCloseTo(2.3);
  }
  expect(timePoint(1).x).not.toBe(timePoint(2).x);
});
it("ribbon has real thickness and finite indexed surface normals", () => {
  const geometry = createTimeRibbon(11);
  const p = geometry.attributes.position;
  const ys = Array.from({ length: p.count }, (_, i) => p.getY(i));
  expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(0.18);
  expect(geometry.index!.count).toBeGreaterThan(p.count);
  expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
  expect(
    Array.from(geometry.attributes.normal.array).every(Number.isFinite),
  ).toBe(true);
  expect(geometry.boundingSphere!.radius).toBeGreaterThan(40);
  geometry.dispose();
});
