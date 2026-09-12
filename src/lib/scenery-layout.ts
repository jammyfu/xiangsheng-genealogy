export type SceneryKind =
  | "bank" | "mountain" | "village" | "bridge" | "pine" | "boat" | "willow"
  | "river-village" | "river-gorge" | "river-garden"
  | "opening-cloud-village" | "closing-peaks-temple" | "distant-shore";
export interface SceneryPiece {
  id: string;
  kind: SceneryKind;
  /** Authored position across the entire finite scroll, not a repeating tile. */
  x: number;
  y: number;
  size: number;
  depth: number;
  parallax: number;
  opacity: number;
  mirror: boolean;
  foot: number;
  haze: number;
}
export const SCENERY_KINDS: SceneryKind[] = [
  "bank", "mountain", "bridge", "pine", "boat", "willow",
  "river-village", "river-gorge", "river-garden",
  "opening-cloud-village", "closing-peaks-temple", "distant-shore",
];
/** One authored journey: wooded opening → river village → crossing → gorge → garden.
 * Each image appears once. Empty water between scenes is intentional breathing room. */
export function sceneryLayout(): SceneryPiece[] {
  const slots: [SceneryKind, number, number, number, number, number, number, number][] = [
    ["distant-shore", 0.5, 0.70, 2.0, -140, 0.01, 0.48, 0.56],
    ["mountain", 0.36, 0.68, 2.7, -110, 0.025, 0.28, 0.74],
    ["bank", 0.015, 0.86, 0.82, -36, 0.32, 0.75, 0.67],
    ["river-village", 0.12, 0.90, 1.60, -25, 0.40, 0.94, 0.96],
    ["bridge", 0.34, 0.86, 0.40, -20, 0.42, 0.90, 0.66],
    ["river-gorge", 0.59, 0.78, 2.35, -65, 0.06, 0.83, 0.97],
    ["boat", 0.43, 0.93, 0.16, -8, 0.65, 0.96, 0.82],
    ["river-garden", 0.91, 0.94, 1.85, -15, 0.48, 0.98, 0.96],
    ["opening-cloud-village", 0.0, 0.70, 1.8, -95, 0.025, 0.65, 0.97],
    ["closing-peaks-temple", 1.0, 0.72, 1.9, -85, 0.035, 0.65, 0.97],
    ["pine", 0.00, 1.01, 0.85, 115, 1.30, 1.00, 0.97],
    ["willow", 1.01, 1.00, 0.78, 85, 1.05, 0.96, 0.98],
  ];
  return slots.map(([kind, x, y, size, depth, parallax, opacity, foot]) => ({
    id: kind, kind, x, y, size, depth, parallax, opacity, foot,
    mirror: false,
    haze: Math.max(0, -depth / 260),
  }));
}

/** The genealogy is the 1x focal plane; distance controls apparent travel. */
export function sceneryTravelRate(piece: Pick<SceneryPiece, "kind" | "depth">) {
  if (piece.kind === "distant-shore") return 0.03;
  if (piece.depth > 0) return 1.35;
  if (piece.kind === "opening-cloud-village" || piece.kind === "closing-peaks-temple") return 0.16;
  if (piece.kind === "mountain") return 0.12;
  if (piece.kind === "river-gorge") return 0.28;
  return 0.82;
}

/** Keep the complete distant silhouette inside the paper, even at scroll ends. */
export function distantSceneryX(target: number, width: number, viewportWidth: number) {
  const center = viewportWidth / 2;
  const range = Math.max(0, (viewportWidth - width) / 2 - viewportWidth * 0.06);
  return center + range * Math.tanh((target - center) / Math.max(1, range));
}

/** A gradual transition across the outer two generations, without repeating art. */
export function endpointPresence(endpoint: "opening" | "closing", focus: number, bounds: { x: number; width: number }) {
  const progress = Math.max(0, Math.min(1, (focus - bounds.x) / Math.max(1, bounds.width)));
  const proximity = (endpoint === "opening" ? progress : 1 - progress) / .28;
  const t = Math.max(0, Math.min(1, proximity));
  return 1 - t * t * (3 - 2 * t);
}

export const SCROLL_INSCRIPTIONS = [
  { id: "opening", title: "一脉源流", verse: "云山开卷处，薪火有来人。", seal: "源" },
  { id: "closing", title: "余韵长流", verse: "一舟载清韵，万壑续余声。", seal: "传" },
] as const;

export function riverBoatX(seconds: number, viewportWidth: number, boatWidth: number, distant = false) {
  return ((seconds * (distant ? 7 : 12) + viewportWidth * (distant ? .76 : .32)) % (viewportWidth + boatWidth * 2)) - boatWidth;
}
