import { expect, it } from 'vitest';
import { buildAtlas } from './atlas';
import { loadPeopleFromDisk, loadEdgesFromDisk } from './loadCatalog.node';
import { forceTreeData, forceLinkColor } from './force-tree';
import type { ForcePerson } from './force-tree';
const options = { people: loadPeopleFromDisk(), edges: loadEdgesFromDisk(), selectedId: 'hou-baolin', mode: 'tree' as const, showAll: true };
it('restores solver positions when a pruned branch reopens', () => {
  const cache = new Map<string, ForcePerson>();
  const full = forceTreeData(buildAtlas(options), cache);
  const child = full.nodes.find(n => n.id === 'ma-ji')!;
  child.y = 231; child.z = -98;
  const pruned = forceTreeData(buildAtlas({...options, collapsedIds: new Set(['hou-baolin'])}), cache);
  expect(pruned.nodes.some(n => n.id === 'ma-ji')).toBe(false);
  const reopened = forceTreeData(buildAtlas(options), cache).nodes.find(n => n.id === 'ma-ji');
  expect(reopened).toBe(child); expect(reopened?.y).toBe(231); expect(reopened?.z).toBe(-98);
});
it('does not expose catalog objects to force-link endpoint mutation', () => {
  const graph = buildAtlas(options), original = JSON.stringify(graph);
  const data = forceTreeData(graph, new Map());
  data.links[0].source = data.nodes[0]; data.nodes[0].x = 900;
  expect(JSON.stringify(graph)).toBe(original);
});
it('pins generation order and only links nodes in the visible graph', () => {
  const data = forceTreeData(buildAtlas({...options, collapsedIds: new Set(['ma-ji'])}), new Map());
  const ids = new Set(data.nodes.map(n => n.id));
  for(const n of data.nodes) expect(n.fx).toBe((n.atlas.person.generationIndex - 5) * 110);
  for(const e of data.links) { expect(ids.has(e.source as string)).toBe(true); expect(ids.has(e.target as string)).toBe(true); }
});

it('keeps the selected lineage opaque while hovering unrelated people', () => {
  const data = forceTreeData(buildAtlas(options), new Map());
  const active = data.links.find(e => e.source === 'ma-ji' && e.target === 'jiang-kun')!;
  expect(active.highlighted).toBe(true);
  expect(forceLinkColor(active)).toBe('#8b2626');
  expect(forceLinkColor(active, new Set())).toBe('#8b2626');
  const other = data.links.find(e => e.source === 'ma-sanli' && e.target === 'chang-baohua')!;
  expect(other.highlighted).toBe(false);
  expect(forceLinkColor(other)).toContain('0.10');
  expect(forceLinkColor(other, new Set([other.id]))).toBe('#197c85');
});
it('places the current person ahead of the lineage and unrelated branches', () => {
  const data = forceTreeData(buildAtlas(options), new Map());
  const selected = data.nodes.find(n => n.id === 'hou-baolin')!;
  const child = data.nodes.find(n => n.id === 'ma-ji')!;
  const unrelated = data.nodes.find(n => n.id === 'chang-baohua')!;
  expect(selected.depthTarget).toBeGreaterThan(child.depthTarget);
  expect(child.depthTarget).toBeGreaterThan(unrelated.depthTarget);
});
it('uses an opaque third color for overlapping comparison paths', () => {
  const data = forceTreeData(buildAtlas(options),new Map());
  const active=data.links.find(e=>e.highlighted)!;
  expect(forceLinkColor(active,new Set([active.id]))).toBe('#77549c');
  expect(forceLinkColor(active,new Set())).not.toContain('rgba');
});
