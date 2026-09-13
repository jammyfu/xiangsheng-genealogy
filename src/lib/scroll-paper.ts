import {
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  Texture,
  Vector4,
} from "three";

/** One closed sheet: front, reversed back, and the four connected cut edges. */
export function createPaperGeometry(columns = 144, rows = 32) {
  const positions: number[] = [],
    uv: number[] = [],
    sides: number[] = [],
    indices: number[] = [];
  const layerSize = (columns + 1) * (rows + 1);
  for (const side of [1, -1]) {
    for (let y = 0; y <= rows; y++)
      for (let x = 0; x <= columns; x++) {
        positions.push((x / columns) * 2 - 1, (y / rows) * 2 - 1, 0);
        uv.push(x / columns, y / rows);
        sides.push(side);
      }
  }
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < columns; x++) {
      const a = y * (columns + 1) + x,
        b = a + 1,
        c = a + columns + 1,
        d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  const frontCount = indices.length;
  for (let i = 0; i < frontCount; i += 3)
    indices.push(
      indices[i] + layerSize,
      indices[i + 2] + layerSize,
      indices[i + 1] + layerSize,
    );
  const perimeter: number[] = [];
  for (let x = 0; x <= columns; x++) perimeter.push(x);
  for (let y = 1; y <= rows; y++) perimeter.push(y * (columns + 1) + columns);
  for (let x = columns - 1; x >= 0; x--)
    perimeter.push(rows * (columns + 1) + x);
  for (let y = rows - 1; y > 0; y--) perimeter.push(y * (columns + 1));
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i],
      b = perimeter[(i + 1) % perimeter.length];
    indices.push(a, a + layerSize, b, b, a + layerSize, b + layerSize);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setAttribute("paperSide", new Float32BufferAttribute(sides, 1));
  geometry.setIndex(indices);
  geometry.addGroup(0, frontCount, 0);
  geometry.addGroup(frontCount, indices.length - frontCount, 1);
  return geometry;
}

/** A bounded window into ONE painting: no tiled rivers or mirrored villages. */
export function paintingWindow(
  width: number,
  height: number,
  panX: number,
  aspect = 3,
) {
  const ratio = Math.max(1, width) / Math.max(1, height);
  const spanY = Math.min(0.94, aspect / ratio);
  const spanX = Math.min(1, (ratio / aspect) * spanY);
  const travel = Math.tanh(-panX / Math.max(width, 1));
  return new Vector4(
    (1 - spanX) * (0.5 + travel * 0.5),
    (1 - spanY) / 2,
    spanX,
    spanY,
  );
}

export function createPaintedPaperMaterial(
  texture: Texture,
  window: Vector4,
  strength: number,
) {
  const material = new MeshStandardMaterial({
    map: texture,
    color: "#fffaf0",
    roughness: 0.98,
    metalness: 0,
  });
  material.userData.waterTime = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.waterTime = material.userData.waterTime;
    shader.uniforms.paintWindow = { value: window };
    shader.uniforms.inkStrength = { value: strength };
    shader.vertexShader =
      "varying vec2 paperUv;\n" +
      shader.vertexShader.replace(
        "#include <uv_vertex>",
        "#include <uv_vertex>\npaperUv = uv;",
      );
    shader.fragmentShader =
      "uniform vec4 paintWindow;\nuniform float inkStrength;\nuniform float waterTime;\nvarying vec2 paperUv;\n" +
      shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
      vec2 paintUv = paintWindow.xy + paperUv * paintWindow.zw;
      float waterMask = 1.0 - smoothstep(0.27, 0.40, paperUv.y);
      vec2 flowUv = paintUv + waterMask * vec2(
        sin(paperUv.y * 150.0 - waterTime * 0.48 + paperUv.x * 3.0) * 0.0025,
        sin(paperUv.y * 220.0 - waterTime * 0.65) * 0.0007);
      vec4 painted = texture2D(map, clamp(flowUv, 0.0, 1.0));
      painted.rgb *= 1.0 - waterMask * 0.012 * (0.5 + 0.5 * sin(paperUv.y * 340.0 - waterTime * 0.8 + paperUv.x * 6.0));
      float edge = smoothstep(0.0, 0.035, paintUv.x) * smoothstep(0.0, 0.035, 1.0-paintUv.x)
        * smoothstep(0.0, 0.04, paintUv.y) * smoothstep(0.0, 0.04, 1.0-paintUv.y);
      diffuseColor.rgb *= mix(vec3(1.0), painted.rgb, inkStrength * edge);
      float grain = fract(sin(dot(floor(paperUv * vec2(2200.0,1300.0)),vec2(12.9898,78.233)))*43758.5453);
      float fiber = sin(paperUv.y * 4100.0 + sin(paperUv.x * 470.0) * 2.0);
      diffuseColor.rgb *= 0.979 + grain * 0.017 + fiber * 0.004;
    `,
      );
  };
  material.customProgramCacheKey = () => "continuous-xuan-paper-water-v2";
  return material;
}
