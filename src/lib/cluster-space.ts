/** A shallow cylindrical name cloud: staggered rings keep a readable silhouette. */
export function clusterAngle(ordinal: number) {
  return ((ordinal % 3) - 1) * (Math.PI * 2 / 3) + Math.sin(Math.floor(ordinal / 3) * 1.7) * 0.06;
}
export function clusterPoint(ordinal: number, rotation: number, radius = 190) {
  const angle = clusterAngle(ordinal) + rotation;
  return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
}
