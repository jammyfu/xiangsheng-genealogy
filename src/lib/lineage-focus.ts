/** Follow upstream and downstream independently, so an ancestor's other branches
 * do not accidentally become part of the selected person's lineage. */
export function lineageFocus(selectedId: string, edges: readonly { id: string; from: string; to: string }[]) {
  const nodes = new Set([selectedId]);
  const links = new Set<string>();
  for (const direction of ['up', 'down'] as const) {
    const seen = new Set<string>(), queue = [selectedId];
    while (queue.length) {
      const id = queue.pop()!;
      if (seen.has(id)) continue;
      seen.add(id); nodes.add(id);
      for (const edge of edges) {
        if ((direction === 'up' ? edge.to : edge.from) !== id) continue;
        links.add(edge.id);
        queue.push(direction === 'up' ? edge.from : edge.to);
      }
    }
  }
  return { nodes, links };
}

export function lineageComparison(selectedId: string, hoveredId: string | null, edges: readonly { id: string; from: string; to: string }[]) {
  const selected = lineageFocus(selectedId, edges);
  const compared = hoveredId && hoveredId !== selectedId
    ? lineageFocus(hoveredId, edges) : { nodes: new Set<string>(), links: new Set<string>() };
  return { selected, compared,
    sharedNodes: new Set([...selected.nodes].filter(id => compared.nodes.has(id))),
    sharedLinks: new Set([...selected.links].filter(id => compared.links.has(id))),
  };
}
