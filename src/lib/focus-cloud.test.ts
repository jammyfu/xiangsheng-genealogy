import { expect, it } from 'vitest';
import { focusCloud } from './focus-cloud';
import { buildFixedScroll } from './fixed-scroll';
import { lineageFocus } from './lineage-focus';
import { loadPeopleFromDisk, loadEdgesFromDisk } from './loadCatalog.node';
import { firstDisciple } from './disciple-order';

const people = loadPeopleFromDisk(), edges = loadEdgesFromDisk();
for (const [selectedId, discipleId] of Object.entries(firstDisciple)) {
  it(`puts the recorded first disciple of ${selectedId} first on the horizontal spine`, () => {
    expect(edges.some(e => e.from === selectedId && e.to === discipleId)).toBe(true);
    const graph = buildFixedScroll({ people, edges, selectedId, mode: 'scroll' });
    // A junior with many pupils must not outrank the recorded first disciple.
    for (const n of graph.nodes) if (n.person.id !== discipleId) n.childCount += 1000;
    const layout = focusCloud(graph, lineageFocus(selectedId, graph.edges).nodes, { width: 1100, height: 550 });
    const anchor = layout.slots.get(selectedId)!;
    const next = [...layout.slots.entries()].filter(([, s]) => s.trunk && s.x > anchor.x).sort((a, b) => a[1].x - b[1].x)[0];
    expect(next?.[0]).toBe(discipleId);
  });
}
for (const selectedId of ['hou-baolin', 'yu-qian', 'guo-degang', 'ma-delu']) {
  for (const viewport of [{ width: 1100, height: 550 }, { width: 390, height: 600 }, { width: 1600, height: 900 }, { width: 800, height: 420 }]) {
    it(`packs ${selectedId} inside ${viewport.width} × ${viewport.height} without overlaps`, () => {
      const graph = buildFixedScroll({ people, edges, selectedId, mode: 'scroll' });
      const highlighted = lineageFocus(selectedId, graph.edges).nodes;
      for (const zoom of [.3, 1, 2.4]) {
        const layout = focusCloud(graph, highlighted, viewport, zoom);
        expect(layout.slots.has(selectedId)).toBe(true);
        expect(layout.slots.get(selectedId)!.x).toBe(viewport.width / 2);
        expect(layout.slots.size + layout.hidden).toBe(people.length);
        const boxes = [...layout.slots.values()];
        let overlaps = false;
        for (const [i, a] of boxes.entries()) {
          expect(a.scale).toBeGreaterThanOrEqual(.72);
          expect(a.x - a.width / 2).toBeGreaterThanOrEqual(18);
          expect(a.x + a.width / 2).toBeLessThanOrEqual(viewport.width - 18);
          expect(a.y - a.height / 2).toBeGreaterThanOrEqual(0);
          expect(a.y + a.height / 2).toBeLessThanOrEqual(viewport.height - 112);
          for (const b of boxes.slice(i + 1)) {
            if (Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2) overlaps = true;
          }
        }
        expect(overlaps).toBe(false);
      }
    });
  }
}

it('reserves the spine for real consecutive teacher–disciple relationships', () => {
  const graph = buildFixedScroll({ people, edges, selectedId: 'yu-qian', mode: 'scroll' });
  const layout = focusCloud(graph, lineageFocus('yu-qian', graph.edges).nodes, { width: 1400, height: 800 });
  const spine = [...layout.slots.entries()].filter(([, s]) => s.trunk).sort((a, b) => a[1].x - b[1].x);
  for (let i = 1; i < spine.length; i++) expect(graph.edges.some(e => e.from === spine[i - 1][0] && e.to === spine[i][0])).toBe(true);
  expect(spine.map(([id]) => id)).toContain('shi-fuquan');
  expect(spine.map(([id]) => id)).toContain('gao-fengshan');
  expect(spine.map(([id]) => id)).toContain('gao-deliang');
  expect(spine.map(([id]) => id)).not.toContain('cao-dekui');
});
