import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial, Vector2 } from 'three';
import type { Camera, WebGLRenderer } from 'three';

/** A single GPU point cloud, rendered behind the graph in its existing renderer. */
export function createGenealogyStars() {
  let seed = 73129;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const positions: number[] = [], colors: number[] = [], sizes: number[] = [], phases: number[] = [], strengths: number[] = [];
  const count = 46000;
  for (let i = 0; i < count; i++) {
    const field = i < 1400;
    const core = i % 5 === 0;
    const dust = i % 7 === 0 && !field;
    const radius = core ? Math.pow(random(), 1.8) * .48 : Math.pow(random(), .72) * 1.48;
    const arm = i % 4;
    const angle = core ? random() * Math.PI * 2 : arm * Math.PI / 2 + radius * 4.1 + (random() - .5) * (.27 + .48 / (radius + .35));
    const scatter = (random() - .5) * .12;
    positions.push(field ? (random() - .5) * 5.5 : Math.cos(angle) * radius + scatter,
      field ? (random() - .5) * 3.5 : Math.sin(angle) * radius + scatter,
      field ? random() * 1.6 - .8 : (random() - .5) * (.07 + .2 * Math.exp(-radius * 3)));
    const warm = !field && (radius < .48 || random() < .36);
    colors.push(...(warm ? [1, .79 + random() * .13, .61 + random() * .19] : [.57 + random() * .22, .71 + random() * .17, 1]));
    sizes.push(dust ? 12 + random() * 30 : field ? 1.1 + Math.pow(random(), 5) * 4.5 : 1.25 + Math.pow(random(), 8) * 3.2);
    strengths.push(dust ? .027 : field ? .85 : .7);
    phases.push(random() * Math.PI * 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new Float32BufferAttribute(phases, 1));
  geometry.setAttribute('aStrength', new Float32BufferAttribute(strengths, 1));
  const uniforms = { uTime: { value: 0 }, uAspect: { value: 1 }, uDpr: { value: 1 }, uPointer: { value: new Vector2() }, uOrbit: { value: new Vector2() } };
  const material = new ShaderMaterial({
    uniforms, transparent: true, depthTest: false, depthWrite: false,
    blending: AdditiveBlending, vertexColors: true, toneMapped: false,
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      attribute float aStrength;
      uniform float uTime, uAspect, uDpr;
      uniform vec2 uPointer, uOrbit;
      varying vec3 vColor;
      varying float vAlpha;
      mat2 turn(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
      void main() {
        vec3 p = position;
        p.xy = turn(uTime * .007) * p.xy;
        p.yz = turn(.78 + uOrbit.y * .1 + uPointer.y * .06) * p.yz;
        p.xy = turn(-.42 + uOrbit.x * .1) * p.xy;
        float depth = 1.0 / (1.0 + p.z * .26);
        vec2 screen = p.xy * depth * .86;
        screen += uPointer * (.016 + depth * .022);
        screen.x = screen.x / uAspect + .12;
        gl_Position = vec4(screen, .999, 1.0);
        gl_PointSize = clamp(aSize * depth * uDpr, 1.0, 48.0 * uDpr);
        vColor = color;
        vAlpha = aStrength * (.8 + .2 * sin(aPhase + uTime * .5));
      }`,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - .5) * 2.0;
        if (r > 1.0) discard;
        float glow = exp(-r * r * 6.0) * .65 + pow(1.0 - r, 3.0) * .5;
        gl_FragColor = vec4(vColor, glow * vAlpha);
      }`,
  });
  const points = new Points(geometry, material);
  points.name = 'genealogy-starfield';
  points.frustumCulled = false;
  points.renderOrder = -1000;
  points.raycast = () => {};
  const pointer = new Vector2();
  const viewport = new Vector2();
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = media.matches, last = 0;
  const preference = () => { reduced = media.matches; pointer.set(0, 0); uniforms.uPointer.value.set(0, 0); };
  media.addEventListener('change', preference);
  points.onBeforeRender = (renderer: WebGLRenderer, _scene, camera: Camera) => {
    const now = performance.now();
    const dt = last ? Math.min((now - last) / 1000, .05) : 0;
    last = now;
    renderer.getSize(viewport);
    uniforms.uAspect.value = viewport.x / Math.max(1, viewport.y);
    uniforms.uDpr.value = Math.min(renderer.getPixelRatio(), 2);
    if (!reduced) {
      uniforms.uTime.value += dt;
      uniforms.uPointer.value.lerp(pointer, 1 - Math.exp(-dt * 3));
    }
    uniforms.uOrbit.value.set(camera.quaternion.y, camera.quaternion.x);
  };
  return {
    points,
    move(x: number, y: number) { if (!reduced) pointer.set(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))); },
    dispose() { media.removeEventListener('change', preference); points.removeFromParent(); geometry.dispose(); material.dispose(); },
  };
}
