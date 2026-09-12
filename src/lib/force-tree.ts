import { lineageFocus } from "./lineage-focus";
import type { NodeObject, LinkObject } from '3d-force-graph';
import type { AtlasLayout, AtlasNode } from './atlas';
export interface ForcePerson extends NodeObject { id: string; atlas: AtlasNode; related: boolean; depthTarget: number; }
export interface ForceRelation extends LinkObject<ForcePerson> { id: string; disputed: boolean; highlighted: boolean; }
/** Reuse solver-owned objects when branches reopen, without mutating catalog data. */
export function forceTreeData(graph: AtlasLayout, cache: Map<string, ForcePerson>) {
  const focus = lineageFocus(graph.nodes.find(n => n.selected)?.person.id ?? "", graph.edges);
  const nodes = graph.nodes.map((atlas, index) => {
    const id = atlas.person.id;
    let node = cache.get(id);
    if (!node) {
      const parent = graph.edges.find(edge => edge.to === id);
      const origin = parent && cache.get(parent.from);
      const angle = index * 2.399963;
      node = { id, atlas, related: false, depthTarget: 0, x: (atlas.person.generationIndex - 5) * 110,
        y: (origin?.y ?? 0) + Math.sin(angle) * 55,
        z: (origin?.z ?? 0) + Math.cos(angle) * 55 };
      cache.set(id, node);
    }
    node.atlas = atlas;
    node.related = focus.nodes.has(id);
    node.depthTarget = atlas.selected ? 200 : node.related ? 45 : -160 - Math.sin(index * 2.4) * 75;
    node.fx = (atlas.person.generationIndex - 5) * 110;
    return node;
  });
  const links: ForceRelation[] = graph.edges.map(edge => ({
    id: edge.id, source: edge.from, target: edge.to,
    disputed: Boolean(edge.disputed), highlighted: focus.links.has(edge.id),
  }));
  return { nodes, links };
}

/** Current, comparison and shared paths remain fully opaque. */
export function forceLinkColor(edge: ForceRelation, comparisonLinks: ReadonlySet<string> = new Set()) {
  if (edge.highlighted && comparisonLinks.has(edge.id)) return '#77549c';
  if (edge.highlighted) return edge.disputed ? '#a36922' : '#8b2626';
  if (comparisonLinks.has(edge.id)) return '#197c85';
  return 'rgba(112,133,121,0.10)';
}
