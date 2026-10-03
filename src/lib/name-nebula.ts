import type { AtlasLayout, AtlasNode } from './atlas';
import type { Person, Edge } from '../types';
import type { ForcePerson } from './force-tree';

/** Actual catalog names supply the volume; only opened genealogy edges are connected. */
export function nameNebulaGraph(graph: AtlasLayout, catalog: AtlasLayout): AtlasLayout {
  const visible = new Set(graph.nodes.map(n => n.person.id));
  const context: AtlasNode[] = catalog.nodes.filter(n => !visible.has(n.person.id)).map(n => ({
    ...n, selected: false, dimmed: graph.hasFilter, hiddenChildren: n.childCount,
  }));
  return {...graph, nodes: [...graph.nodes, ...context]};
}
const hash = (id: string) => [...id].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
/** Stable family cohorts and depth keep repeated selections from shuffling the cloud. */
export function nameNebulaPositions(people: Person[], edges: Edge[]) {
  const byId = new Map(people.map(p => [p.id,p]));
  const parents = new Map<string,string>();
  for (const edge of edges) if (!parents.has(edge.to)) parents.set(edge.to,edge.from);
  return new Map(people.map(person => {
    let family = person.id;
    const visited = new Set<string>();
    while (!visited.has(family) && (byId.get(family)?.generationIndex ?? 0) > 5 && parents.has(family)) {
      visited.add(family); family = parents.get(family)!;
    }
    const phase = hash(family) / 4294967296 * Math.PI * 2;
    const seed = hash(person.id) / 4294967296;
    const angle = phase + (seed-.5)*1.6 + person.generationIndex*.24;
    const radius = 95 + Math.sqrt(seed)*300;
    return [person.id,{x:Math.cos(angle)*radius*.5,y:Math.sin(angle)*radius,z:Math.cos(angle)*radius*.62}] as const;
  }));
}
export function positionNameNebula(nodes: ForcePerson[], positions: ReturnType<typeof nameNebulaPositions>) {
  for (const node of nodes) {
    const position = positions.get(node.id);
    if (!position) continue;
    if (!node.related) {
      node.fx = (node.atlas.person.generationIndex-5)*110+position.x;
      node.fy = position.y;
      node.depthTarget = -240 + position.z;
      node.fz = node.depthTarget;
    } else { node.fy = undefined; node.fz = undefined; }
  }
}
