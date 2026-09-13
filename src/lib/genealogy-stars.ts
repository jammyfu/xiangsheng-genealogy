import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Mesh, PlaneGeometry, Points, ShaderMaterial, Vector2 } from 'three';
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
    strengths.push(dust ? .045 : field ? 1 : .85);
    phases.push(random() * Math.PI * 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new Float32BufferAttribute(phases, 1));
  geometry.setAttribute('aStrength', new Float32BufferAttribute(strengths, 1));
  const uniforms = { uTime: { value: 0 }, uAspect: { value: 1 }, uDpr: { value: 1 }, uPointer: { value: new Vector2() }, uOrbit: { value: new Vector2() }, uPulse: { value: new Vector2() }, uPulseAge: { value: 10 }, uMotion: { value: 1 }, uHover: { value: 0 } };
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
      varying float vSpark;
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
        vSpark = step(3.0, aSize) * (1.0 - step(8.0, aSize));
      }`,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSpark;
      void main() {
        float r = length(gl_PointCoord - .5) * 2.0;
        if (r > 1.0) discard;
        float glow = exp(-r * r * 6.0) * .65 + pow(1.0 - r, 3.0) * .5;
        vec2 uv = abs(gl_PointCoord - .5);
        glow += vSpark * (exp(-uv.x * 60.0) + exp(-uv.y * 60.0)) * pow(1.0 - r, 2.0) * .4;
        gl_FragColor = vec4(vColor, glow * vAlpha);
      }`,
  });
  const points = new Points(geometry, material);
  points.name = 'genealogy-starfield';
  points.frustumCulled = false;
  points.renderOrder = -1000;
  points.raycast = () => {};
  const veilGeometry = new PlaneGeometry(2, 2);
  const veilMaterial = new ShaderMaterial({
    uniforms, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending, toneMapped: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, .9999, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime, uAspect, uPulseAge, uMotion, uHover;
      uniform vec2 uPointer, uOrbit, uPulse;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }
      void main() {
        vec2 screen = vUv * 2.0 - 1.0;
        vec2 p = (screen - vec2(.12, 0)) * vec2(uAspect, 1.0) - uPointer * .035;
        float angle = .42 - uOrbit.x * .1;
        p = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;
        p.y *= 1.4;
        float radius = length(p), theta = atan(p.y, p.x) + uTime * .007;
        float cloud = noise(p * 4.0 + uTime * .012) * .55 + noise(p * 11.0) * .3 + noise(p * 29.0) * .15;
        float arms = pow(.5 + .5 * cos(theta * 4.0 - radius * 18.0 + cloud * 3.0), 3.0);
        float envelope = (1.0 - smoothstep(.35, 1.55, radius)) * smoothstep(.02, .32, radius);
        vec3 tint = mix(vec3(.15,.26,.65), vec3(.42,.18,.48), .5 + .5 * sin(theta * 2.0 + radius * 5.0));
        vec3 light = tint * arms * envelope * cloud * .32;
        light += vec3(.55,.36,.19) * exp(-radius * radius * 12.0) * (.12 + cloud * .22);
        float cursor = length((screen - uPointer) * vec2(uAspect,1));
        light += vec3(.08,.26,.4) * exp(-cursor * cursor * 5.0) * uHover * .16;
        float pulseRadius = length((screen - uPulse) * vec2(uAspect,1));
        float wave = exp(-pow((pulseRadius - uPulseAge * .62) * 42.0, 2.0)) * exp(-uPulseAge * 2.4);
        light += vec3(.55,.34,.2) * wave * .42 * uMotion;
        // Sparse, short-lived meteors; never flash the entire scene.
        float phase = mod(uTime + 6.0, 16.0);
        float travel = phase / 2.4;
        vec2 head = vec2(.75 - travel * 1.5, .73 - travel * .75);
        vec2 d = screen - head;
        float along = dot(d, normalize(vec2(2,1)));
        float across = abs(dot(d, normalize(vec2(-1,2))));
        float meteor = exp(-across * 700.0) * exp(-max(0.0,along) * 25.0) * step(0.0,along);
        meteor *= smoothstep(0.0,.3,phase) * (1.0 - smoothstep(1.8,2.4,phase)) * uMotion;
        light += vec3(.35,.6,.8) * meteor * .7;
        gl_FragColor = vec4(light, 1.0);
      }`,
  });
  const veil = new Mesh(veilGeometry, veilMaterial);
  veil.name = 'genealogy-nebula'; veil.frustumCulled = false; veil.renderOrder = -1001; veil.raycast = () => {};
  points.add(veil);
  const pointer = new Vector2();
  const viewport = new Vector2();
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = media.matches, last = 0, hover = 0;
  uniforms.uMotion.value = reduced ? 0 : 1;
  const preference = () => { reduced = media.matches; uniforms.uMotion.value = reduced ? 0 : 1; uniforms.uPulseAge.value = 10; pointer.set(0, 0); uniforms.uPointer.value.set(0, 0); };
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
      uniforms.uPulseAge.value = Math.min(10, uniforms.uPulseAge.value + dt);
      uniforms.uPointer.value.lerp(pointer, 1 - Math.exp(-dt * 3));
    }
    uniforms.uHover.value += (hover - uniforms.uHover.value) * (reduced ? 1 : 1 - Math.exp(-dt * 4));
    uniforms.uOrbit.value.set(camera.quaternion.y, camera.quaternion.x);
  };
  return {
    points,
    get time() { return uniforms.uTime.value; },
    hover(active: boolean) { hover = active ? 1 : 0; },
    burst(x: number, y: number) { if (!reduced) { uniforms.uPulse.value.set(x, y); uniforms.uPulseAge.value = 0; } },
    move(x: number, y: number) { if (!reduced) pointer.set(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))); },
    dispose() { media.removeEventListener('change', preference); points.removeFromParent(); geometry.dispose(); material.dispose(); veilGeometry.dispose(); veilMaterial.dispose(); },
  };
}
