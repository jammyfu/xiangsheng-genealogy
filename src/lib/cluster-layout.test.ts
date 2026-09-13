import { expect, it } from "vitest";
import { layoutCluster, nameSlipHeight, separateClusterRow } from "./cluster-layout";
import { clusterPoint } from "./cluster-space";

it("reserves name length, selected type and hover depth between adjacent rows", () => {
  const names = ["高凤山", "陈雨亭", "常连安", "侯一尘", "郭荣起", "郭启儒", "连秀全", "李寿增", "焦寿海", "于俊波", "谭伯如", "马三立", "朱阔泉", "赵霭如", "张寿臣"];
  for (const height of [420, 700, 1080]) {
    const layout = layoutCluster(names, height);
    expect(-layout.top * 2).toBeLessThanOrEqual(height - 220 + 0.001);
    for (let row = 1; row < layout.rows.length; row++) {
      const previous = Math.max(...names.slice((row - 1) * 3, row * 3).map(nameSlipHeight));
      const next = Math.max(...names.slice(row * 3, row * 3 + 3).map(nameSlipHeight));
      const clearance = layout.rows[row] - layout.rows[row - 1] - (previous + next) / 2 * layout.magnification * layout.scale;
      expect(clearance).toBeGreaterThan(8);
    }
    // Title has a 64px backing and a separate 22px breathing space.
    const titleBottom = layout.top - 54 + 32;
    expect(layout.rows[0] - nameSlipHeight(names[0]) * layout.magnification * layout.scale / 2 - titleBottom).toBeGreaterThan(22);
  }
});

it("fits long and short names without changing layout on selection", () => {
  const layout = layoutCluster(["甲乙", "甲乙丙丁戊", "张三", "李四"], 700);
  expect(nameSlipHeight("甲乙丙丁戊")).toBe(151);
  expect(layout.rows[1] - layout.rows[0]).toBeGreaterThan((151 + 88) / 2 * layout.magnification * layout.scale);
});

it("keeps all three backed names apart through a complete cluster rotation", () => {
  for (let angle = -Math.PI; angle <= Math.PI; angle += 0.015) {
    const items = [0, 1, 2].map(i => ({ id: String(i), x: clusterPoint(i, angle).x }));
    const positions = [...separateClusterRow(items, 72).values()].sort((a, b) => a - b);
    expect(positions[1] - positions[0]).toBeGreaterThanOrEqual(72 - 1e-8);
    expect(positions[2] - positions[1]).toBeGreaterThanOrEqual(72 - 1e-8);
    expect(positions.reduce((a, b) => a + b, 0)).toBeCloseTo(items.reduce((sum, p) => sum + p.x, 0));
  }
});
