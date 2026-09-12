import { expect, it } from "vitest";
import { clusterAngle, clusterPoint } from "./cluster-space";
it("rotates each name through a true depth arc without changing its orbit radius", () => {
  const a = clusterPoint(8, 0), b = clusterPoint(8, .6);
  expect(a.x).not.toBeCloseTo(b.x);
  expect(a.z).not.toBeCloseTo(b.z);
  expect(Math.hypot(a.x,a.z)).toBeCloseTo(Math.hypot(b.x,b.z));
});
it("brings any selected name to the front of its cluster", () => {
  for(let ordinal=0; ordinal<23; ordinal++) {
    const p=clusterPoint(ordinal,-clusterAngle(ordinal));
    expect(p.x).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(190);
  }
});
