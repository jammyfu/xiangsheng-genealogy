import { useEffect, useMemo } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from "three";
import type { AtlasCamera, AtlasViewport } from "../lib/atlas";
import { cameraDistance, perspectiveAnchor } from "../lib/scroll-space";
import type { Motion } from "./ScrollScene";

// Separate water planes weave behind the island, behind the bridge, and across
// its feet. Soft, broken ink strokes preserve the underlying painted river.
const reaches = [
  { name: "far", y: .72, height: .15, depth: -76, rate: .16, speed: .035, ink: .12, rows: 29 },
  { name: "middle", y: .855, height: .16, depth: -31, rate: .48, speed: .065, ink: .20, rows: 19 },
  { name: "near", y: .965, height: .12, depth: -5, rate: .90, speed: .10, ink: .27, rows: 11 },
];

export function RiverWaterLayers({ viewport, view, motion, active, running }: {
  viewport: AtlasViewport; view: AtlasCamera; motion: MutableRefObject<Motion>;
  active: boolean; running: boolean;
}) {
  const layers = useMemo(() => reaches.map(reach => {
    const material = new ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: { time: { value: 0 }, offset: { value: new Vector2() },
        ink: { value: reach.ink }, rows: { value: reach.rows }, speed: { value: reach.speed } },
      vertexShader: `varying vec2 waterUv;
        void main(){waterUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 waterUv; uniform float time, ink, rows, speed; uniform vec2 offset;
        void main(){
          vec2 p=waterUv+offset;
          float row=floor(p.y*rows);
          float wave=sin(p.x*19.+row*2.7-time*speed)*.06;
          float line=pow(max(0.,cos((p.y*rows+wave)*6.28318)),22.);
          float breaks=smoothstep(.05,.65,sin(p.x*37.+row*13.-time*speed));
          float envelope=smoothstep(0.,.24,waterUv.y)*smoothstep(0.,.24,1.-waterUv.y);
          float glint=pow(max(0.,cos((p.y*rows+wave+.15)*6.28318)),28.)*breaks;
          vec3 pigment=mix(vec3(.40,.46,.40),vec3(.98,.94,.79),glint);
          gl_FragColor=vec4(pigment,envelope*(line*breaks+glint*.55)*ink);
        }`,
    });
    const mesh = new Mesh(new PlaneGeometry(1, 1), material);
    mesh.name = `river-water:${reach.name}`;
    mesh.renderOrder = reach.depth + 100;
    mesh.frustumCulled = false;
    return { reach, mesh, material };
  }), []);
  useEffect(() => () => layers.forEach(({mesh, material}) => { mesh.geometry.dispose(); material.dispose(); }), [layers]);
  useFrame((_, dt) => {
    if (!active) return;
    const displayed = motion.current.displayedView ?? view;
    const pointer = motion.current.pointer;
    const distance = cameraDistance(viewport.height);
    for (const {reach, mesh, material} of layers) {
      if (running) material.uniforms.time.value += Math.min(dt, .1);
      material.uniforms.offset.value.set(-displayed.x * reach.rate / Math.max(1, viewport.width), 0);
      const anchor = perspectiveAnchor(viewport.width / 2 + pointer.x * reach.rate * 18,
        viewport.height * reach.y - pointer.y * reach.rate * 12, reach.depth, viewport.width, viewport.height);
      mesh.position.set(anchor.x, anchor.y, anchor.z);
      const compensation = (distance - reach.depth) / distance;
      mesh.scale.set(viewport.width * 1.12 * compensation, viewport.height * reach.height * compensation, 1);
      mesh.visible = motion.current.open > .08;
    }
  }, -1);
  return <group name="river-water-depth-layers">{layers.map(({reach, mesh}) => <primitive key={reach.name} name={`river-water:${reach.name}`} object={mesh} />)}</group>;
}
