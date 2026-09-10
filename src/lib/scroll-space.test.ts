import { describe, expect, it } from "vitest";
import { buildAtlas, type AtlasNode } from "./atlas";
import { loadEdgesFromDisk, loadPeopleFromDisk } from "./loadCatalog.node";
import {
  cameraDistance,
  constrainPointer,
  dampValue,
  isSelectionGesture,
  nodeDepth,
  perspectiveAnchor,
  scrollSurface,
  type Point3,
} from "./scroll-space";

const people = loadPeopleFromDisk();
const graph = buildAtlas({
  people,
  edges: loadEdgesFromDisk(),
  selectedId: "hou-baolin",
  mode: "scroll",
  showAll: true,
  viewportWidth: 945,
});
const selectedGeneration = people.find(
  (person) => person.id === "hou-baolin",
)!.generationIndex;

// Independent pinhole projection verifies the public pixel-space contract.
function project(point: Point3, width: number, height: number) {
  const focalLength = height / (2 * Math.tan((19 * Math.PI) / 180));
  return {
    x: width / 2 + (point.x * focalLength) / (focalLength - point.z),
    y: height / 2 - (point.y * focalLength) / (focalLength - point.z),
  };
}

describe("scroll perspective placement", () => {
  it("fits the camera's reference plane to the stage height", () => {
    expect(cameraDistance(600, 90)).toBeCloseTo(300, 8);
    expect(cameraDistance(600)).toBeCloseTo(871.2632633027468, 8);
    expect(Number.isFinite(cameraDistance(0))).toBe(true);
    expect(cameraDistance(0)).toBeGreaterThan(0);
  });

  it.each([
    { width: 945, height: 650 },
    { width: 358, height: 580 },
  ])(
    "retains exact label slots at different depths in a $width px stage",
    ({ width, height }) => {
      for (const node of graph.nodes) {
        const z = nodeDepth(node, selectedGeneration);
        for (const [x, y] of [
          [node.x, node.y],
          [node.x - node.width / 2, node.y - node.height / 2],
          [node.x + node.width / 2, node.y + node.height / 2],
        ]) {
          const projected = project(
            perspectiveAnchor(x, y, z, width, height),
            width,
            height,
          );
          expect(projected.x, node.person.name).toBeCloseTo(x, 8);
          expect(projected.y, node.person.name).toBeCloseTo(y, 8);
        }
      }
    },
  );

  it("keeps projected labels separated within each generation", () => {
    for (const column of graph.columns) {
      const cohort = graph.nodes
        .filter((node) => node.person.generationIndex === column.index)
        .sort((a, b) => a.y - b.y);
      const boundary = (node: AtlasNode, y: number) =>
        project(
          perspectiveAnchor(
            node.x,
            y,
            nodeDepth(node, selectedGeneration),
            945,
            650,
          ),
          945,
          650,
        ).y;
      for (let index = 1; index < cohort.length; index += 1) {
        const previous = cohort[index - 1];
        const current = cohort[index];
        expect(
          boundary(current, current.y - current.height / 2) -
            boundary(previous, previous.y + previous.height / 2),
        ).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("gives selection foreground depth and bounds extreme generation differences", () => {
    const selected = graph.nodes.find((node) => node.selected)!;
    const foreground = nodeDepth(selected, selectedGeneration);
    const background = graph.nodes.filter((node) => !node.selected);
    expect(
      background.every(
        (node) => nodeDepth(node, selectedGeneration) < foreground,
      ),
    ).toBe(true);
    const sameGeneration = { ...selected, selected: false, vertical: false };
    expect(
      nodeDepth({ ...sameGeneration, dimmed: true }, selectedGeneration),
    ).toBeLessThan(
      nodeDepth({ ...sameGeneration, dimmed: false }, selectedGeneration),
    );
    for (const generationIndex of [-1000, 0, 6, 1000]) {
      const node = {
        ...sameGeneration,
        person: { ...selected.person, generationIndex },
      };
      const depth = nodeDepth(node, selectedGeneration);
      expect(depth).toBeGreaterThanOrEqual(-65);
      expect(depth).toBeLessThanOrEqual(75);
    }
    expect(
      nodeDepth(
        {
          ...sameGeneration,
          person: { ...selected.person, generationIndex: 5 },
        },
        6,
      ),
    ).not.toBe(
      nodeDepth(
        {
          ...sameGeneration,
          person: { ...selected.person, generationIndex: 7 },
        },
        6,
      ),
    );
  });
});

describe("scroll surface and interaction", () => {
  it("makes two finite raised rims and opens them in response to pointer direction", () => {
    const center = scrollSurface(0, 0, { x: 0, y: 0 });
    const left = scrollSurface(-1, 0, { x: 0, y: 0 });
    const right = scrollSurface(1, 0, { x: 0, y: 0 });
    expect(left.x).toBeLessThan(-0.8);
    expect(right.x).toBeGreaterThan(0.8);
    expect(left.z).toBeGreaterThan(center.z + 0.03);
    expect(right.z).toBeGreaterThan(center.z + 0.03);
    expect(scrollSurface(1, 0, { x: 1, y: 0 }).z).not.toBeCloseTo(
      scrollSurface(1, 0, { x: -1, y: 0 }).z,
      4,
    );
    expect(scrollSurface(0.25, 0.25, { x: 0, y: 1 }).z).not.toBeCloseTo(
      scrollSurface(0.25, 0.25, { x: 0, y: -1 }).z,
      4,
    );
  });

  it("keeps opening, reduced-motion rest, and extreme pointer geometry bounded", () => {
    for (const settle of [0, 0.5, 1]) {
      for (const pointer of [
        { x: 0, y: 0 },
        { x: -1, y: 1 },
        { x: 50, y: -50 },
      ]) {
        for (const u of [-1, -0.75, 0, 0.75, 1]) {
          for (const v of [-1, 0, 1]) {
            const point = scrollSurface(u, v, pointer, settle);
            expect(Object.values(point).every(Number.isFinite)).toBe(true);
            expect(Math.abs(point.x)).toBeLessThanOrEqual(1.05);
            expect(Math.abs(point.y)).toBeLessThanOrEqual(1.05);
            expect(Math.abs(point.z)).toBeLessThanOrEqual(0.25);
          }
        }
      }
    }
    const closed = scrollSurface(1, 0, { x: 0, y: 0 }, 0);
    const open = scrollSurface(1, 0, { x: 0, y: 0 }, 1);
    expect(open.x).toBeGreaterThan(closed.x + 0.2);
    expect(open.z).toBeLessThan(closed.z);
  });

  it("clamps pointer input without amplifying movement outside the stage", () => {
    expect(constrainPointer(4, -3)).toEqual({ x: 1, y: -1 });
    expect(constrainPointer(0.25, -0.5)).toEqual({ x: 0.25, y: -0.5 });
    expect(constrainPointer(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it("converges equally over the same elapsed time at 30, 60, and 120 fps", () => {
    const advance = (fps: number) => {
      let value = -0.8;
      for (let frame = 0; frame < fps; frame += 1)
        value = dampValue(value, 0.9, 1 / fps);
      return value;
    };
    expect(advance(30)).toBeCloseTo(advance(60), 10);
    expect(advance(60)).toBeCloseTo(advance(120), 10);
    expect(advance(60)).toBeGreaterThan(0.89);
    expect(advance(60)).toBeLessThan(0.9);
    expect(dampValue(0, 1, 0)).toBe(0);
    expect(dampValue(0, 1, -1)).toBe(0);
    expect(dampValue(0, 1, 5)).toBeCloseTo(dampValue(0, 1, 0.05), 10);
  });

  it.each([
    { distance: 0, selected: true },
    { distance: 6, selected: true },
    { distance: 6.01, selected: false },
    { distance: 50, selected: false },
    { distance: Number.NaN, selected: false },
    { distance: -1, selected: false },
  ])(
    "treats movement of $distance px as selection=$selected",
    ({ distance, selected }) => {
      expect(isSelectionGesture(distance)).toBe(selected);
    },
  );
});
