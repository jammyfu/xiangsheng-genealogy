export interface TreeLabelCandidate {
  id: string; x: number; y: number; width: number; height: number; priority: number;
}
export interface TreeLabelPlacement extends TreeLabelCandidate { anchorX: number; anchorY: number }
export interface LabelObstacle { x: number; y: number; width: number; height: number }
/** Move names into nearby free slots, rather than discarding overlapping names. */
export function layoutTreeLabels(candidates: TreeLabelCandidate[], width: number, height: number, obstacles: LabelObstacle[] = []) {
  const cellWidth = 84, cellHeight = 36;
  const columns = Math.floor((width - 16) / cellWidth), rows = Math.floor((height - 16) / cellHeight);
  const occupied = new Set<number>();
  const slots = Array.from({length: Math.max(0, columns * rows)}, (_, index) => ({index, x:8 + (index % columns) * cellWidth, y:8 + Math.floor(index / columns) * cellHeight})).filter(slot => !obstacles.some(other => slot.x < other.x + other.width && slot.x + cellWidth > other.x && slot.y < other.y + other.height && slot.y + cellHeight > other.y));
  const placed: TreeLabelPlacement[] = [];
  for (const label of [...candidates].sort((a,b) => b.priority - a.priority || a.id.localeCompare(b.id))) {
    const anchorX = label.x + label.width / 2, anchorY = label.y + label.height / 2;
    let slot: (typeof slots)[number] | undefined, distance = Infinity;
    for (const option of slots) {
      if (occupied.has(option.index)) continue;
      const next = (option.x + cellWidth/2-anchorX)**2 + (option.y + cellHeight/2-anchorY)**2;
      if (next < distance) { distance = next; slot = option; }
    }
    if (!slot || label.width > cellWidth - 4 || label.height > cellHeight - 4) continue;
    occupied.add(slot.index);
    placed.push({...label, x:slot.x+(cellWidth-label.width)/2, y:slot.y+(cellHeight-label.height)/2, anchorX, anchorY});
  }
  return placed;
}
