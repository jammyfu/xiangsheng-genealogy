import type { AtlasLayout } from "./atlas";
import { layoutCluster, nameSlipHeight } from "./cluster-layout";

/** Main ancestry stays on one reading axis; context retains its readable three-dimensional cloud. */
export function branchLayout(graph: AtlasLayout, highlighted: Set<string>, height: number) {
  const slots = new Map<string, { x: number; y: number; scale: number; rear: boolean; trunk: boolean }>();
  for (const column of graph.columns) {
    const people = graph.nodes.filter(n => n.person.generationIndex === column.index);
    const trunk = people.filter(n => ["current", "mentor", "ancestor"].includes(n.focusRole ?? ""))
      .sort((a, b) => Number(b.selected) - Number(a.selected));
    const main = people.filter(n => highlighted.has(n.person.id) && !trunk.includes(n));
    const rear = people.filter(n => !highlighted.has(n.person.id));
    const rows = Math.max(1, Math.ceil((main.length + Math.max(0, trunk.length - 1)) / 3));
    const scale = Math.min(.9, height * .42 / (Math.max(2, rows) * 120));
    trunk.slice(0, 1).forEach(n => slots.set(n.person.id, { x: 0, y: 0, scale: Math.max(.65, scale), rear: false, trunk: true }));
    [...trunk.slice(1), ...main].forEach((n, index) => {
      const row = Math.floor(index / 3);
      const sign = row % 2 === 0 ? -1 : 1;
      slots.set(n.person.id, { x: ((index % 3) - 1) * 88 * scale,
        y: sign * (Math.floor(row / 2) + 1) * 135 * scale,
        scale, rear: false, trunk: false });
    });
    const cloud = layoutCluster(people.map(n => n.person.name), height);
    // Reserve space for the foreground before sizing a growing background column.
    const rearRows = Math.max(1, Math.ceil(rear.length / 6));
    const tallestRear = Math.max(1, ...rear.map(n => nameSlipHeight(n.person.name)));
    const rearScale = Math.max(.22, Math.min(cloud.scale * .92,
      (height * .8 / (rearRows + 4) - 12) / (tallestRear * .8)));
    // Rear slips are perspective-reduced: use their rear-plane envelope rather
    // than the foreground magnification reserved by layoutCluster.
    const normalStepX = Math.max(40, 44 * rearScale * .8 + 12);
    const rearHeights = rear.map(n => nameSlipHeight(n.person.name)).sort((a, b) => a - b);
    const typicalHeight = rearHeights[Math.floor(rearHeights.length / 2)] ?? 88;
    const stepY = Math.min(60, Math.max(32, typicalHeight * rearScale + 8));
    const rearColumns = rearRows * stepY > height * .8 ? 5 : 3;
    const stepX = rearColumns === 5 ? 31 : normalStepX;
    const occupied = people.filter(n => slots.has(n.person.id)).map(n => {
      const s = slots.get(n.person.id)!;
      return { x: s.x, y: s.y, width: 60 * s.scale, height: (nameSlipHeight(n.person.name) + 24) * s.scale * 1.3, padding: 12 };
    });
    // Pack only the background names, not the whole generation's ordinals:
    // foreground names no longer leave large empty holes in the rear cloud.
    let candidate = 0;
    for (const n of rear) {
      let x = 0, y = 0;
      while (true) {
        const row = Math.floor(candidate / rearColumns);
        x = ((candidate % rearColumns) - Math.floor(rearColumns / 2)) * stepX;
        y = (row === 0 ? 0 : Math.ceil(row / 2) * (row % 2 ? -1 : 1)) * stepY;
        candidate++;
        if (!occupied.some(s => Math.abs(s.x - x) < (s.width + 44 * rearScale) / 2 + 10 && Math.abs(s.y - y) < (s.height + nameSlipHeight(n.person.name) * rearScale) / 2 + s.padding)) break;
      }
      slots.set(n.person.id, { x, y, scale: rearScale, rear: true, trunk: false });
      // Long disambiguated names reserve only their own cells, not every row.
      occupied.push({ x, y, width: 44 * rearScale,
        height: nameSlipHeight(n.person.name) * rearScale, padding: 4 });
    }
  }
  return slots;
}
