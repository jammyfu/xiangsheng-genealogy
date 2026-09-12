import { expect, it } from "vitest";
import {
  buildFixedScroll,
  boundScrollCamera,
  focusScrollCamera,
  minimumScrollScale,
} from "./fixed-scroll";
import { loadPeopleFromDisk, loadEdgesFromDisk } from "./loadCatalog.node";
const options = {
  people: loadPeopleFromDisk(),
  edges: loadEdgesFromDisk(),
  selectedId: "hou-baolin",
  mode: "scroll" as const,
};
it("keeps every name at the same world position across selection, filters and resize", () => {
  const a = buildFixedScroll(options);
  const b = buildFixedScroll({
    ...options,
    selectedId: "guo-degang",
    query: "郭",
    viewportWidth: 390,
  });
  expect(a.nodes.length).toBe(options.people.length);
  expect(a.nodes.map((n) => [n.person.id, n.x, n.y])).toEqual(
    b.nodes.map((n) => [n.person.id, n.x, n.y]),
  );
  expect(a.bounds).toEqual(b.bounds);
});
it("clamps both ends at the first and last name and keeps travel horizontal", () => {
  const graph = buildFixedScroll(options),
    viewport = { width: 1200, height: 700 };
  for (const scale of [minimumScrollScale(viewport, graph), 1, 2.4]) {
    const first = graph.nodes[0],
      last = graph.nodes.at(-1)!;
    const start = focusScrollCamera(viewport, graph, first.person.id, scale);
    const end = focusScrollCamera(viewport, graph, last.person.id, scale);
    expect(start.x + first.x * scale).toBe(viewport.width * 0.5);
    expect(end.x + last.x * scale).toBeCloseTo(viewport.width * 0.5);
    expect(
      boundScrollCamera({ ...start, x: 1e8, y: 1e8 }, viewport, graph),
    ).toEqual(start);
    expect(
      boundScrollCamera({ ...end, x: -1e8, y: -1e8 }, viewport, graph),
    ).toEqual(end);
  }
});

it('limits zoom-out at a responsive overview while preserving the focal world point', () => {
  const graph = buildFixedScroll(options);
  for (const width of [390, 1200, 1920]) {
    const viewport = { width, height: 800 };
    const focus = graph.nodes[Math.floor(graph.nodes.length / 2)].x;
    const result = boundScrollCamera({ x: width / 2 - focus * .02, y: 0, scale: .02 }, viewport, graph);
    expect(result.scale).toBe(minimumScrollScale(viewport, graph));
    expect(result.scale).toBeGreaterThanOrEqual(.12);
    expect(result.scale).toBeLessThanOrEqual(.45);
    expect((width / 2 - result.x) / result.scale).toBeCloseTo(focus);
  }
});

it('promotes the current lineage and reverses depth when a rear branch is selected', () => {
  const front = buildFixedScroll(options);
  const role = (id: string) => front.nodes.find(n => n.person.id === id)!;
  expect(role('ma-ji').focusRole).toBe('disciple');
  expect(role('zhu-kuoquan').focusRole).toBe('mentor');
  expect(role('ma-ji').focusDepth).toBeGreaterThan(role('hou-baolin').focusDepth!);
  expect(role('guo-degang').focusRole).toBe('background');
  expect(66 / (1-role('guo-degang').focusDepth!)).toBeGreaterThan(44);
  const switched = buildFixedScroll({ ...options, selectedId: 'guo-degang' });
  expect(switched.nodes.find(n => n.person.id === 'guo-degang')!.focusDepth).toBeGreaterThan(0);
  expect(switched.nodes.find(n => n.person.id === 'hou-yaowen')!.focusRole).toBe('mentor');
});

it('keeps all names in unique three-column positions inside each generation panel', () => {
  const graph = buildFixedScroll(options);
  for (const group of graph.columns) {
    const nodes = graph.nodes.filter(n => n.person.generationIndex === group.index);
    expect(new Set(nodes.map(n => n.x)).size).toBe(1);
    expect(new Set(nodes.map(n => `${n.deckColumn}:${n.y}`)).size).toBe(nodes.length);
    expect(nodes.every(n => (n.deckColumn ?? 0) < 3)).toBe(true);
    expect(new Set(nodes.map(n => n.deckPage))).toEqual(new Set([0]));
  }
  expect(graph.bounds.width).toBeLessThan(graph.columns.length * 500);
});

it("names the three founding generations without changing later generation labels", () => {
  const graph = buildFixedScroll(options);
  expect(graph.columns.slice(0, 3).map(c => c.label)).toEqual(["第一代", "第二代", "第三代"]);
  expect(graph.columns.slice(3, 8).map(c => c.label)).toEqual(["德", "寿", "宝", "文", "明"]);
});
