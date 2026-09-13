import type { AtlasLayout } from './atlas';
import { nameSlipHeight } from './cluster-layout';
import { firstDisciple } from './disciple-order';

export type ReadingSlot = { x: number; y: number; scale: number; rear: boolean; trunk: boolean; width: number; height: number };

/** Screen-space packing: a stable ancestry spine inside an elliptical name cloud.
 * Never shrink text below reading size just to fit the entire catalogue. */
export function focusCloud(graph: AtlasLayout, highlighted: Set<string>, viewport: { width: number; height: number }, zoom = 1) {
  const slots = new Map<string, ReadingSlot>();
  const { width, height } = viewport;
  const margin = width < 600 ? 18 : 32;
  const top = Math.min(170, height * .31), bottom = height - 112;
  const cx = width / 2, cy = (top + bottom) / 2;
  const rx = Math.max(30, cx - margin), ry = Math.max(35, (bottom - top) / 2);
  const magnify = Math.max(.95, Math.min(1.25, zoom));
  const selected = graph.nodes.find(n => n.selected);
  const byId = new Map(graph.nodes.map(n => [n.person.id, n]));
  const spine: string[] = [];
  if (selected) {
    // Walk a real path; do not turn contemporaries into teachers.
    const walk = (id: string, backwards: boolean): string[] => {
      const result: string[] = [], seen = new Set([id]);
      while (true) {
        const candidates = graph.edges.filter(e => backwards ? e.to === id : e.from === id)
          .map(e => ({ edge: e, node: byId.get(backwards ? e.from : e.to) })).filter(n => n.node && !seen.has(n.node.person.id))
          .sort((a, b) => {
            if (!backwards) {
              const preferred = firstDisciple[id];
              const seniority = Number(b.node!.person.id === preferred) - Number(a.node!.person.id === preferred);
              if (seniority) return seniority;
            }
            // Existing notes distinguish auxiliary instruction from the formal
            // portal. This is a display preference, not a new historical edge.
            const rank = (e: typeof a.edge) => /^(技艺师承|开蒙师承)|口盟/.test(e.note ?? '') ? 2 : e.disputed ? 1 : 0;
            return rank(a.edge) - rank(b.edge) || b.node!.childCount - a.node!.childCount || a.node!.person.id.localeCompare(b.node!.person.id);
          });
        const next = candidates[0]?.node;
        if (!next) break;
        id = next.person.id; seen.add(id); result.push(id);
      }
      return result;
    };
    const capacity = Math.max(0, Math.floor((rx - 32) / (90 * magnify)));
    const ancestors = walk(selected.person.id, true).slice(0, capacity);
    const descendants = walk(selected.person.id, false).slice(0, capacity);
    const place = (id: string, x: number, scale: number, trunk: boolean, y = cy) => {
      const n = byId.get(id)!;
      const w = (n.selected ? 104 : trunk ? 50 : [...n.person.name].length * 24 + 24) * scale;
      const h = (trunk ? Math.max(n.selected ? 116 : 88, nameSlipHeight(n.person.name)) + (n.selected ? 62 : 10) : 44) * scale;
      const box = { x, y, scale, width: w, height: h, trunk, rear: !highlighted.has(id) };
      if (x - w / 2 < margin || x + w / 2 > width - margin || y - h / 2 < top || y + h / 2 > bottom) return false;
      for (const s of slots.values()) {
        if (Math.abs(s.x - x) < (s.width + w) / 2 + 9 && Math.abs(s.y - y) < (s.height + h) / 2 + 12) return false;
      }
      slots.set(id, box); return true;
    };
    const selectedHeight = Math.max(116, nameSlipHeight(selected.person.name)) + 62;
    place(selected.person.id, cx, Math.min(1.02 * magnify, (bottom - top - 8) / selectedHeight), true);
    const side = (ids: string[], direction: number) => { for (const [i, id] of ids.entries()) {
      const step = Math.min(116, (rx - 32) / Math.max(1, ids.length));
      if (!place(id, cx + direction * (i + 1) * step, .92 * magnify, true)) break;
      spine.push(id);
    } };
    side(ancestors, -1); side(descendants, 1);
    spine.push(selected.person.id);
    const priority = (n: typeof selected) => graph.hasFilter && !n.dimmed ? 0 : n.focusRole === 'mentor' ? 1 : n.focusRole === 'ancestor' ? 2 : n.focusRole === 'disciple' ? 3 : highlighted.has(n.person.id) ? 4 : 5;
    const rest = graph.nodes.filter(n => !slots.has(n.person.id)).sort((a, b) => priority(a) - priority(b) || a.person.id.localeCompare(b.person.id));
    // Deterministic candidate grid prevents jitter when the pointer moves.
    const candidates: { x: number; y: number }[] = [];
    for (let y = top + 35; y <= bottom - 35; y += 14) {
      for (let x = margin + 22; x <= width - margin - 22; x += 14) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= .98) candidates.push({ x, y });
      }
    }
    const candidateOrders = new Map<string, typeof candidates>();
    for (const n of rest) {
      const related = highlighted.has(n.person.id);
      const direction = Math.sign(n.person.generationIndex - selected.person.generationIndex);
      const targetX = related ? cx + direction * rx * .50 : cx;
      const orderKey = `${related}:${direction}`;
      const ordered = candidateOrders.get(orderKey) ?? [...candidates].sort((a, b) => {
        const score = (p: typeof a) => ((p.x - targetX) / rx) ** 2 + ((p.y - cy) / ry) ** 2 * (related ? .6 : .9);
        return score(a) - score(b);
      });
      candidateOrders.set(orderKey, ordered);
      const scale = (related ? .85 : .76) * magnify;
      for (const p of ordered) {
        // Leave the spine's horizontal band clear: nearby names must not look
        // like intermediate teachers on a line they do not belong to.
        if (Math.abs(p.y - cy) < 74 * magnify) continue;
        if (related && direction && Math.sign(p.x - cx) !== direction) continue;
        if (place(n.person.id, p.x, scale, false, p.y)) break;
      }
    }
  }
  return { slots, spine: new Set(spine), hidden: graph.nodes.length - slots.size };
}
