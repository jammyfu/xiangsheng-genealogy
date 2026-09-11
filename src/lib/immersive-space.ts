import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";

/** Ordinal route. UI must not imply equal time intervals between events. */
export function timePoint(index: number) {
  return new Vector3(Math.sin(index * 0.78) * 4.2, 0, -index * 8);
}
export function eventPoint(index: number) {
  const point = timePoint(index);
  point.x += index % 2 ? 2.3 : -2.3;
  point.y = 2.9;
  return point;
}
/** A closed, thick ribbon, not a flat picture of a road. */
export function createTimeRibbon(count: number) {
  const vertices: number[] = [],
    indices: number[] = [];
  const steps = Math.max(96, count * 48);
  for (let i = 0; i <= steps; i++) {
    const t = -0.8 + ((count + 0.6) * i) / steps;
    const p = timePoint(t);
    const tangent = timePoint(t + 0.001)
      .sub(p)
      .normalize();
    const normal = new Vector3(-tangent.z, 0, tangent.x).multiplyScalar(2);
    for (const [side, y] of [
      [-1, 0],
      [1, 0],
      [-1, -0.18],
      [1, -0.18],
    ]) {
      vertices.push(p.x + normal.x * side, y, p.z + normal.z * side);
    }
    if (i < steps) {
      const a = i * 4,
        b = a + 4;
      indices.push(
        a,
        b,
        a + 1,
        a + 1,
        b,
        b + 1,
        a + 2,
        a + 3,
        b + 2,
        a + 3,
        b + 3,
        b + 2,
        a,
        a + 2,
        b,
        a + 2,
        b + 2,
        b,
        a + 1,
        b + 1,
        a + 3,
        a + 3,
        b + 1,
        b + 3,
      );
    }
  }
  const end = steps * 4;
  indices.push(
    0,
    1,
    2,
    1,
    3,
    2,
    end,
    end + 2,
    end + 1,
    end + 1,
    end + 2,
    end + 3,
  );
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
