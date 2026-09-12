import { expect, it } from "vitest";
import { branchLayout } from "./branch-layout";
import { buildFixedScroll } from "./fixed-scroll";
import { loadPeopleFromDisk, loadEdgesFromDisk } from "./loadCatalog.node";
import { lineageComparison } from "./lineage-focus";

it("keeps the ancestry axis straight and compresses unrelated people without removing them", () => {
  const graph = buildFixedScroll({ people: loadPeopleFromDisk(), edges: loadEdgesFromDisk(), selectedId: "zhao-zhenduo", mode: "scroll" });
  const path = lineageComparison("zhao-zhenduo", null, graph.edges).selected;
  const slots = branchLayout(graph, path.nodes, 800);
  expect(slots.size).toBe(graph.nodes.length);
  const main = [...slots.values()].filter(s => s.trunk);
  expect(main.length).toBeGreaterThan(3);
  main.forEach(s => { expect(s.x).toBe(0); expect(s.y).toBe(0); });
  for (const node of graph.nodes) {
    const slot = slots.get(node.person.id)!;
    expect(slot.rear).toBe(!path.nodes.has(node.person.id));
    if (slot.rear) { expect(slot.scale).toBeGreaterThan(.2); expect(slot.scale).toBeLessThan(1); expect(Math.abs(slot.y)).toBeLessThanOrEqual(800); }
  }
});

it('packs rear names into narrow columns without overlaps or ordinal holes', () => {
  const graph = buildFixedScroll({ people: loadPeopleFromDisk(), edges: loadEdgesFromDisk(), selectedId: 'zhu-kuoquan', mode: 'scroll' });
  const path = lineageComparison('zhu-kuoquan', null, graph.edges).selected;
  const slots = branchLayout(graph, path.nodes, 800);
  const shifted = { ...graph, nodes: graph.nodes.map(n => ({ ...n, deckOrdinal: (n.deckOrdinal ?? 0) + 90 })) };
  expect(branchLayout(shifted, path.nodes, 800)).toEqual(slots);
  for (const column of graph.columns) {
    const rear = graph.nodes.filter(n => n.person.generationIndex === column.index).map(n => slots.get(n.person.id)!).filter(s => s.rear);
    expect(rear.every(s => Math.abs(s.x) <= 62)).toBe(true);
    expect(new Set(rear.map(s => `${s.x}:${s.y}`)).size).toBe(rear.length);
  }
});
