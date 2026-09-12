import { cameraDistance } from "./scroll-space";

/** Reserve the larger selected typeface, even before a name is selected. */
export function nameSlipHeight(name: string) {
  return Math.max(88, Array.from(name).length * 27 + 16);
}

export function layoutCluster(names: string[], viewportHeight: number) {
  // Includes the nearest disciple plane, orbit and the hover lift. Reserving
  // this envelope keeps selecting/hovering from moving neighbouring rows.
  const distance = cameraDistance(viewportHeight);
  const magnification = distance / (distance * 0.82 - 43);
  const rowHeights: number[] = [];
  names.forEach((name, index) => {
    const row = Math.floor(index / 3);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, (nameSlipHeight(name) + 14) * magnification);
  });
  const gap = 18;
  const height = rowHeights.reduce((sum, h) => sum + h, 0) + Math.max(0, rowHeights.length - 1) * gap;
  const scale = Math.min(1, Math.max(80, viewportHeight - 220) / Math.max(1, height));
  let cursor = -height / 2;
  const rows = rowHeights.map(h => {
    const y = (cursor + h / 2) * scale;
    cursor += h + gap;
    return y;
  });
  return { scale, rows, top: -height * scale / 2, magnification };
}

/** Screen-space exclusion zones stop rotating slips crossing over one another. */
export function separateClusterRow<T extends { id: string; x: number }>(items: T[], minimumDistance: number) {
  const ordered = [...items].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
  const positions = ordered.map(item => item.x);
  for (let i = 1; i < positions.length; i++) {
    positions[i] = Math.max(positions[i], positions[i - 1] + minimumDistance);
  }
  const displacement = positions.reduce((sum, x, i) => sum + x - ordered[i].x, 0) / Math.max(1, positions.length);
  return new Map(ordered.map((item, i) => [item.id, positions[i] - displacement]));
}
