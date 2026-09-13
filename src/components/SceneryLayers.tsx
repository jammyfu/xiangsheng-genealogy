import { useEffect, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  ShaderMaterial,
} from "three";
import type { AtlasCamera, AtlasViewport } from "../lib/atlas";
import { cameraDistance, perspectiveAnchor } from "../lib/scroll-space";
import {
  SCENERY_KINDS,
  sceneryLayout,
  sceneryTravelRate,
  distantSceneryX,
  endpointPresence,
  SCROLL_INSCRIPTIONS,
  riverBoatX,
} from "../lib/scenery-layout";
import type { Motion } from "./ScrollScene";
import { RiverWaterLayers } from "./RiverWaterLayers";

/** Individual high-resolution local sprites. Magenta is removed in the GPU
 * material, preserving the original source files and fine silhouette detail. */
export function SceneryLayers({
  viewport,
  view,
  motion,
  active,
  running,
  worldBounds,
}: {
  viewport: AtlasViewport;
  view: AtlasCamera;
  motion: MutableRefObject<Motion>;
  active: boolean;
  running: boolean;
  worldBounds?: { x: number; width: number };
}) {
  const sources = useTexture(
    SCENERY_KINDS.map((kind) => `/assets/spatial/pieces/${kind}.png`),
  );
  const pieces = useMemo(() => {
    const arranged = sceneryLayout();
    const boat = arranged.find(piece => piece.kind === "boat")!;
    const mountain = arranged.find(piece => piece.kind === "mountain")!;
    return [
      ...[.12, .88].map((x, i) => ({ ...mountain, id: `overview-mountain-${i}`, x, y: .78 + i * .04, size: 1.5, opacity: .22, haze: .65, mirror: i === 1 })),
      ...arranged,
      { ...boat, id: "boat-distant", size: .105, y: .91, depth: -28, opacity: .65 },
    ];
  }, []);
  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);
  const textures = useMemo(
    () =>
      SCENERY_KINDS.map((_, i) => {
        const texture = sources[i].clone();
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = 4;
        texture.needsUpdate = true;
        return texture;
      }),
    [...sources],
  );
  const materials = useMemo(
    () =>
      pieces.map((piece) => {
        const material = new MeshBasicMaterial({
          map: textures[SCENERY_KINDS.indexOf(piece.kind)],
          transparent: true,
          // Painted layers sit on the paper visually. Their world-space depth
          // controls parallax/order, but must not intersect the curled sheet.
          depthWrite: false,
          depthTest: false,
          alphaTest: 0.035,
          toneMapped: false,
          side: DoubleSide,
          opacity: piece.opacity * (piece.kind === "mountain" ? 0.82 : 1),
        });
        material.onBeforeCompile = (shader) => {
          shader.uniforms.sceneryHaze = { value: piece.haze };
          shader.uniforms.footUv = { value: 1 - piece.foot };
          shader.uniforms.footSoftness = {
            value: piece.kind === "mountain" ? 0.06 : 0.035,
          };
          shader.fragmentShader =
            "uniform float sceneryHaze;\nuniform float footUv;\nuniform float footSoftness;\n" +
            shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_fragment>",
            `
        vec4 scenery = texture2D(map, vMapUv);
        float chroma = max(scenery.r,max(scenery.g,scenery.b))-min(scenery.r,min(scenery.g,scenery.b));
        float fringe = 1.0-smoothstep(0.38,0.7,chroma);
        float coverage = clamp(1.0 - (min(scenery.r,scenery.b)-scenery.g)/0.8,0.0,1.0);
        vec3 pigment = clamp((scenery.rgb-(1.0-coverage)*vec3(0.9,0.004,0.9))/max(coverage,0.001),0.0,1.0);
        float spill = max(0.0, min(pigment.r,pigment.b)-pigment.g);
        pigment.rb -= vec2(spill);
        pigment.r = mix(pigment.r, min(pigment.r,pigment.g+0.035), smoothstep(0.01,0.08,spill));
        pigment = mix(pigment, vec3(0.86,0.83,0.74), sceneryHaze);
        float groundFade = smoothstep(footUv-0.01, footUv+footSoftness, vMapUv.y);
        diffuseColor.rgb *= pigment;
        diffuseColor.a *= scenery.a * fringe * coverage * smoothstep(0.015,0.07,coverage) * groundFade;
      `,
          );
        };
        material.customProgramCacheKey = () => "ink-scenery-atmosphere-v3";
        return material;
      }),
    [pieces, textures],
  );
  const riverTime = useRef(0);
  const inscriptions = useRef(new Map<string, HTMLDivElement>());
  const meshes = useRef(new Map<string, Mesh>());
  const contacts = useRef(new Map<string, Mesh>());
  const contactMaterial = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        vertexShader: `varying vec2 groundUv;
      void main(){ groundUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `varying vec2 groundUv;
      void main(){ vec2 p=(groundUv-0.5)*2.0; float a=exp(-dot(p,p)*4.5)*0.14;
        a*=(1.0-smoothstep(0.7,1.0,length(p))); gl_FragColor=vec4(0.31,0.34,0.28,a); }`,
      }),
    [],
  );
  useEffect(() => () => contactMaterial.dispose(), [contactMaterial]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(
    () => () => textures.forEach((texture) => texture.dispose()),
    [textures],
  );
  useEffect(
    () => () => materials.forEach((material) => material.dispose()),
    [materials],
  );
  useFrame((_, dt) => {
    if (!active) return;
    if (running) riverTime.current += Math.min(dt, .1);
    const pointer = motion.current.pointer;
    const displayed = motion.current.displayedView ?? view;
    const travel = Math.tanh(view.x / Math.max(1, viewport.width));
    const distance = cameraDistance(viewport.height);
    const focus = (viewport.width / 2 - displayed.x) / displayed.scale;
    for (const inscription of SCROLL_INSCRIPTIONS) {
      const el = inscriptions.current.get(inscription.id);
      if (!el) continue;
      const presence = worldBounds ? endpointPresence(inscription.id, focus, worldBounds) : 0;
      el.style.opacity = String(presence);
      el.style.visibility = presence > .01 ? "visible" : "hidden";
    }
    for (const piece of pieces) {
      const mesh = meshes.current.get(piece.id);
      if (!mesh) continue;
      const amplitude = Math.min(30, viewport.width * .025) *
        (piece.kind === "distant-shore" ? .06 : piece.depth > 0 ? 1 : piece.kind === "river-gorge" ? .6 : piece.depth < -50 ? .12 : .45);
      const rate = sceneryTravelRate(piece);
      const focalX = viewport.width * 0.5;
      let px = worldBounds
        ? focalX +
          ((worldBounds.x + piece.x * worldBounds.width) * displayed.scale + displayed.x - focalX) * rate
        : piece.x * viewport.width +
          pointer.x * amplitude +
          travel * amplitude * 1.7;
      // Place the actual base of the depicted object onto its shoreline,
      // rather than centering transparent square files at arbitrary heights.
      const nominalSize =
        Math.min(
          Math.max(viewport.width, viewport.height * 0.82),
          viewport.height * 1.8,
        ) * piece.size;
      const source = textures[SCENERY_KINDS.indexOf(piece.kind)].image;
      const aspect = source?.width && source?.height ? source.width / source.height : 1;
      const endpoint = piece.kind === "opening-cloud-village" ? "opening" : piece.kind === "closing-peaks-temple" ? "closing" : null;
      const distant = piece.kind === "mountain" || piece.kind === "river-gorge" || endpoint !== null;
      const presence = 1;
      (mesh.material as MeshBasicMaterial).opacity = piece.opacity * (piece.kind === "mountain" ? .82 : 1) * presence;
      if (piece.kind === "pine") px -= viewport.width * .23;
      if (piece.kind === "willow") px += viewport.width * .23;
      // Asset size is independent of its travel speed.
      const sizeRate = piece.kind === "mountain" ? 0.45 : piece.kind === "river-gorge" ? 0.62 : endpoint ? .65 : rate;
      const size = worldBounds
        ? (piece.depth > 0
            ? Math.min(1200 * piece.size, viewport.height * 0.48)
            : 1200 * piece.size * sizeRate) * displayed.scale
        : nominalSize;
      let width = piece.kind === "distant-shore" ? viewport.width * 1.16 : Math.min(size, viewport.height * (piece.depth > 0 ? 0.50 : 0.46) * aspect * (distant ? 1 : displayed.scale),
        distant ? viewport.width * 0.76 : Infinity);
      if (piece.kind === "boat") {
        // Compare painted figures, not label cards: the seated garden figure
        // occupies ~80/2172 of its width; the boatman ~235/1254 of his sprite.
        // A standing boatman should read slightly taller than that seated figure.
        const garden = pieces.find(candidate => candidate.kind === "river-garden")!;
        const gardenImage = textures[SCENERY_KINDS.indexOf("river-garden")].image;
        const gardenAspect = gardenImage?.width && gardenImage?.height ? gardenImage.width / gardenImage.height : 1;
        const gardenWidth = worldBounds
          ? Math.min(1200 * garden.size * sceneryTravelRate(garden) * displayed.scale,
              viewport.height * .46 * gardenAspect * displayed.scale)
          : Math.min(Math.min(Math.max(viewport.width, viewport.height * .82), viewport.height * 1.8) * garden.size,
              viewport.height * .46 * gardenAspect * displayed.scale);
        width = gardenWidth * (piece.id === "boat-distant" ? .14 : .22);
      }
      if (piece.kind === "mountain" && worldBounds) {
        // Map the whole finite journey into the distant margin. Feeding raw
        // world coordinates to tanh pinned these layers at its saturated ends.
        const progress = (focus - worldBounds.x) / Math.max(1, worldBounds.width);
        px = distantSceneryX(viewport.width * (.5 + (piece.x - .5) * .3) - (progress - .5) * Math.min(viewport.width * .5, worldBounds.width * rate), width, viewport.width);
      }
      if (piece.kind === "distant-shore") {
        const progress = worldBounds ? (focus - worldBounds.x) / Math.max(1, worldBounds.width) : .5;
        px = viewport.width * (.5 + (.5 - progress) * .06);
      }
      // An atmospheric screen-space layer fills the overview without shrinking
      // landmarks or multiplying villages. It fades away at reading scale.
      if (piece.id.startsWith("overview-mountain-")) {
        width = viewport.width * .82;
        px = viewport.width * piece.x + pointer.x * 3;
        (mesh.material as MeshBasicMaterial).opacity = piece.opacity * Math.max(0, Math.min(1, (1 - displayed.scale) / .55));
      } else if (distant) {
        width = Math.max(width, Math.min(viewport.width * .62, viewport.height * .38 * aspect));
      }
      if (worldBounds) px += pointer.x * amplitude;
      const height = width / aspect;
      if (piece.kind === "boat") {
        // Wrap only once the complete sprite has sailed beyond the viewport.
        const routeWidth = worldBounds?.width ?? viewport.width;
        const boatWorldWidth = width / displayed.scale;
        const routeX = riverBoatX(riverTime.current, routeWidth, boatWorldWidth, piece.id === "boat-distant");
        px = worldBounds
          ? focalX + ((worldBounds.x + routeX) * displayed.scale + displayed.x - focalX) * rate + pointer.x * amplitude
          : routeX;
      }
      const py =
        piece.y * viewport.height -
        (piece.foot - 0.5) * height -
        pointer.y * amplitude * .65 + (piece.kind === "boat" ? Math.sin(riverTime.current * .7) * .7 : 0);
      const anchor = perspectiveAnchor(
        px,
        py,
        piece.depth,
        viewport.width,
        viewport.height,
      );
      mesh.position.set(anchor.x, anchor.y, anchor.z);
      const compensation = (distance - piece.depth) / distance;
      mesh.scale.set(
        width * compensation * (piece.mirror ? -1 : 1),
        height * compensation,
        1,
      );
      mesh.rotation.y = 0;
      mesh.visible =
        motion.current.open > 0.08 && presence > .005 &&
        (!worldBounds ||
          (px + width / 2 > -80 && px - width / 2 < viewport.width + 80));
      const contact = contacts.current.get(piece.id);
      if (contact) {
        const ground = perspectiveAnchor(
          px,
          piece.y * viewport.height - pointer.y * amplitude * .65,
          piece.depth - 1,
          viewport.width,
          viewport.height,
        );
        contact.position.set(ground.x, ground.y, ground.z);
        contact.scale.set(
          width * compensation * 0.86,
          height * compensation * 0.075,
          1,
        );
        contact.visible = mesh.visible;
      }
    }
  }, -1);
  return (
    <group name="handscroll-scenery-layers">
      <RiverWaterLayers viewport={viewport} view={view} motion={motion} active={active} running={running} />
      {SCROLL_INSCRIPTIONS.map(inscription => (
        <Html key={inscription.id} fullscreen zIndexRange={[3, 0]} style={{ pointerEvents: "none" }}>
          <div className={`scroll-inscription is-${inscription.id}`} ref={el => {
            if (el) inscriptions.current.set(inscription.id, el);
            else inscriptions.current.delete(inscription.id);
          }} aria-hidden="true">
            <strong>{inscription.title}</strong>
            <span>{inscription.verse}</span>
            <b>{inscription.seal}</b>
          </div>
        </Html>
      ))}
      {pieces
        .filter((piece) => ["village", "bridge", "boat"].includes(piece.kind))
        .map((piece) => (
          <mesh
            key={`contact-${piece.id}`}
            name={`contact:${piece.id}`}
            geometry={geometry}
            material={contactMaterial}
            renderOrder={piece.depth + 99}
            ref={(mesh) => {
              if (mesh) contacts.current.set(piece.id, mesh);
              else contacts.current.delete(piece.id);
            }}
          />
        ))}
      {pieces.map((piece, i) => (
        <mesh
          key={piece.id}
          name={`scenery:${piece.id}`}
          geometry={geometry}
          material={materials[i]}
          renderOrder={piece.depth + 100}
          ref={(mesh) => {
            if (mesh) meshes.current.set(piece.id, mesh);
            else meshes.current.delete(piece.id);
          }}
        />
      ))}
    </group>
  );
}
