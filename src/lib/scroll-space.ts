import type { AtlasNode } from "./atlas";

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface ScrollPointer {
  x: number;
  y: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

/** Camera at +Z, looking down -Z; world units equal pixels on the Z=0 plane. */
export function cameraDistance(height: number, fov = 38): number {
  const radians = (clamp(finite(fov, 38), 1, 179) * Math.PI) / 180;
  return Math.max(1, finite(height, 1)) / (2 * Math.tan(radians / 2));
}

/** Small, deterministic generation layers; selection always remains in front. */
export function nodeDepth(node: AtlasNode, selectedGeneration: number): number {
  if (node.selected) return 68;
  const relativeGeneration =
    finite(node.person.generationIndex) - finite(selectedGeneration);
  return clamp(
    16 -
      relativeGeneration * 12 +
      (node.vertical ? 10 : 0) -
      (node.dimmed ? 18 : 0),
    -65,
    50,
  );
}

/** Undo perspective magnification so the supplied atlas pixel slot is retained. */
export function perspectiveAnchor(
  screenX: number,
  screenY: number,
  z: number,
  width: number,
  height: number,
): Point3 {
  const depth = finite(z);
  const scale = (cameraDistance(height) - depth) / cameraDistance(height);
  return {
    x: (finite(screenX) - finite(width) / 2) * scale,
    y: (finite(height) / 2 - finite(screenY)) * scale,
    z: depth,
  };
}

/**
 * A normalized sheet with two cylindrical rolled rims and a gentle broad wave.
 * Scale X/Y by half the desired sheet size and Z by the desired relief height.
 * settle=0 is the introductory curl; settle=1 is also the reduced-motion pose.
 */
export function scrollSurface(
  u: number,
  v: number,
  pointer: ScrollPointer,
  settle = 1,
): Point3 {
  const horizontal = clamp(finite(u), -1, 1);
  const vertical = clamp(finite(v), -1, 1);
  const control = constrainPointer(pointer.x, pointer.y);
  const closed = 1 - clamp(finite(settle, 1), 0, 1);
  const side = Math.sign(horizontal);
  const rollStart = 0.82 - closed * 0.34;
  const edge = clamp(
    (Math.abs(horizontal) - rollStart) / (1 - rollStart),
    0,
    1,
  );
  const turn = (2.1 + closed * 0.95) * (1 - control.x * side * 0.18);
  const angle = edge * turn;
  const radius = 0.065 + closed * 0.04;
  const wave =
    Math.sin((horizontal + 0.2) * Math.PI) *
      Math.cos(vertical * Math.PI * 0.7) *
      (0.014 + closed * 0.008) +
    control.y *
      0.018 *
      Math.sin((horizontal + 0.25) * Math.PI) *
      Math.cos(vertical * Math.PI * 0.6) +
    control.x * 0.009 * horizontal * (1 - vertical * vertical);
  return {
    x:
      edge > 0
        ? side * (rollStart + ((1 - rollStart) * Math.sin(angle)) / turn)
        : horizontal,
    y:
      vertical +
      control.y *
        0.008 *
        Math.sin(horizontal * Math.PI) *
        (1 - vertical * vertical),
    z: clamp(radius * (1 - Math.cos(angle)) + wave, -0.245, 0.245),
  };
}

/** Exponential damping uses seconds and limits the first frame after a pause. */
export function dampValue(
  current: number,
  target: number,
  delta: number,
  response = 7,
): number {
  const start = finite(current);
  const end = finite(target, start);
  const elapsed = clamp(finite(delta), 0, 0.05);
  const blend = -Math.expm1(-Math.max(0, finite(response, 7)) * elapsed);
  return start + (end - start) * blend;
}

export function constrainPointer(x: number, y: number): ScrollPointer {
  return { x: clamp(finite(x), -1, 1), y: clamp(finite(y), -1, 1) };
}

export function isSelectionGesture(distance: number): boolean {
  return Number.isFinite(distance) && distance >= 0 && distance <= 6;
}
