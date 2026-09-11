import { useEffect, useRef, useState } from "react";
import type { PointerEventHandler, KeyboardEventHandler } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { Pause, Play, Plus, Crosshair } from "@phosphor-icons/react";
import { createTimeRibbon, timePoint } from "../lib/immersive-space";
import "./ink-world.css";

export interface InkItem {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  position: [number, number, number];
  generation?: string;
  branchLabel?: string;
}
export interface InkLink {
  id: string;
  from: string;
  to: string;
  disputed?: boolean;
  highlighted?: boolean;
}
interface Props {
  dragging?: boolean;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
  onPointerMove?: PointerEventHandler<HTMLDivElement>;
  onPointerUp?: PointerEventHandler<HTMLDivElement>;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  mode: "timeline" | "tree";
  items: InkItem[];
  links?: InkLink[];
  selectedId: string;
  index?: number;
  active?: boolean;
  view?: { x: number; y: number; scale: number };
  onSelect: (id: string) => void;
  onBranch?: (id: string) => void;
}

/** WebGL scene and semantic HTML share the same Three.js projection. */
export default function InkWorld(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const gpuBlocked = useRef(false);
  const initializedWorld = useRef(false);
  const cameraState = useRef({ x: 0, y: 8, z: 19, tx: 0, ty: 1, tz: -9 });
  const labels = useRef(new Map<string, HTMLDivElement>());
  const generationLabels = useRef(new Map<string, HTMLSpanElement>());
  const generationItems =
    props.mode === "tree"
      ? [
          ...new Map(
            props.items
              .filter((item) => item.generation && item.generation !== "待考")
              .map((item) => [item.generation!, item]),
          ).values(),
        ]
      : [];
  const latest = useRef(props);
  latest.current = props;
  const gesture = useRef<{ x: number; index: number } | null>(null);
  const controls = useRef({
    navigate: () => {},
    draw: () => {},
    reset: () => {},
  });
  const [gpu, setGpu] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [moving, setMoving] = useState(false);
  const still = useRef(false);
  still.current = paused || reduced;
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    const container = host.current!;
    let alive = true,
      renderer: THREE.WebGLRenderer | undefined,
      frame = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f5f1e8");
    scene.fog = new THREE.FogExp2(
      "#f5f1e8",
      props.mode === "timeline" ? 0.014 : 0.008,
    );
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 650);
    const position = cameraState.current;
    const pointer = { x: 0, y: 0 };
    const growth = { value: 0 };
    let width = 800,
      height = 600;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    const nodes = new Map<string, THREE.Mesh>();
    const panels = new Map<string, THREE.Mesh>();
    const lines: {
      line: THREE.Line;
      edge: InkLink;
      material: THREE.LineBasicMaterial;
    }[] = [];
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
      geometries.add(geometry);
      materials.add(material);
      const object = new THREE.Mesh(geometry, material);
      scene.add(object);
      return object;
    };
    scene.add(new THREE.HemisphereLight("#fffaf0", "#a3aa9b", 2.1));
    const sun = new THREE.DirectionalLight("#fff8e8", 2);
    sun.position.set(-8, 18, 12);
    scene.add(sun);
    const loader = new THREE.TextureLoader();
    const load = (url: string, ready: (texture: THREE.Texture) => void) => {
      loader.load(
        url,
        (texture) => {
          if (!alive) {
            texture.dispose();
            return;
          }
          textures.add(texture);
          texture.colorSpace = THREE.SRGBColorSpace;
          ready(texture);
          requestDraw();
        },
        undefined,
        () => {
          /* Atmosphere remains usable if an optional texture fails. */
        },
      );
    };
    // A real interior sky sphere: camera can move through the environment.
    load("/assets/spatial/ink-sky.webp", (texture) => {
      const sky = mesh(
        new THREE.SphereGeometry(290, 48, 24),
        new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide,
          fog: false,
          depthWrite: false,
        }),
      );
      sky.name = "ink-sky-dome";
      sky.renderOrder = -10;
    });
    // Alpha scenery is distributed across separate world planes, not baked into the sky.
    load("/assets/spatial/ink-mountains.webp", (texture) => {
      const layers =
        props.mode === "timeline"
          ? Math.max(8, Math.ceil(props.items.length / 2))
          : 7;
      for (let i = 0; i < layers; i++) {
        for (const side of [-1, 1]) {
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.025,
            opacity: i % 3 === 0 ? 0.8 : 0.58,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const mountain = mesh(
            new THREE.PlaneGeometry(42 + (i % 3) * 7, (42 + (i % 3) * 7) / 3),
            material,
          );
          mountain.position.set(side * (21 + (i % 2) * 5), 2, 8 - i * 17);
          mountain.rotation.y = side * 0.3;
          mountain.name = `ink-mountain-${i}-${side}`;
        }
      }
    });
    if (props.mode === "timeline") {
      const ribbon = mesh(
        createTimeRibbon(props.items.length),
        new THREE.MeshStandardMaterial({
          color: "#e8ddc5",
          roughness: 0.95,
          side: THREE.DoubleSide,
        }),
      );
      ribbon.name = "time-scroll-ribbon";
      props.items.forEach((item, i) => {
        const panel = mesh(
          new THREE.BoxGeometry(5.2, 3.7, 0.065),
          new THREE.MeshStandardMaterial({ color: "#f6efdf", roughness: 0.95 }),
        );
        panel.position.set(...item.position);
        panel.name = `event-paper:${item.id}`;
        panels.set(item.id, panel);
        const p = timePoint(i);
        const marker = mesh(
          new THREE.SphereGeometry(0.13, 16, 12),
          new THREE.MeshStandardMaterial({ color: "#963b30", roughness: 0.6 }),
        );
        marker.position.copy(p).setY(0.15);
        marker.name = `event-marker:${item.id}`;
        const anchor = new THREE.Vector3(...item.position);
        const stem = new THREE.BufferGeometry().setFromPoints([
          p.clone().setY(0.15),
          anchor.clone().setY(0.15),
          anchor.clone().setY(1.25),
        ]);
        const material = new THREE.LineBasicMaterial({
          color: "#a45a43",
          transparent: true,
          opacity: 0.6,
        });
        geometries.add(stem);
        materials.add(material);
        scene.add(new THREE.Line(stem, material));
      });
    } else {
      const byId = new Map(props.items.map((item) => [item.id, item]));
      const generations = new Map<string, number[]>();
      props.items.forEach((item) => {
        const [x, y, z] = item.position;
        if (item.generation && !generations.has(item.generation))
          generations.set(item.generation, [x, z]);
        const bead = mesh(
          new THREE.SphereGeometry(0.15, 20, 12),
          new THREE.MeshStandardMaterial({
            color: "#829083",
            roughness: 0.5,
            metalness: 0.06,
          }),
        );
        bead.position.set(x, y, z);
        nodes.set(item.id, bead);
        bead.name = `person:${item.id}`;
      });
      generations.forEach(([x, z], name) => {
        const plane = mesh(
          new THREE.PlaneGeometry(0.05, 17),
          new THREE.MeshBasicMaterial({
            color: "#b4aa8e",
            transparent: true,
            opacity: 0.45,
            side: THREE.DoubleSide,
          }),
        );
        plane.position.set(x - 1.1, 1, z);
        plane.name = `generation:${name}`;
        const paper = mesh(
          new THREE.PlaneGeometry(5.5, 17),
          new THREE.MeshStandardMaterial({
            color: "#ede3ce",
            transparent: true,
            opacity: 0.14,
            depthWrite: false,
            side: THREE.DoubleSide,
            roughness: 1,
          }),
        );
        paper.position.set(x + 1.5, 1, z - 0.5);
        paper.rotation.y = -0.28;
      });
      props.links?.forEach((edge) => {
        const from = byId.get(edge.from),
          to = byId.get(edge.to);
        if (!from || !to) return;
        const a = new THREE.Vector3(...from.position),
          b = new THREE.Vector3(...to.position);
        const mid = (a.x + b.x) / 2;
        const curve = new THREE.CubicBezierCurve3(
          a,
          new THREE.Vector3(mid, a.y, a.z),
          new THREE.Vector3(mid, b.y, b.z),
          b,
        );
        const geometry = new THREE.BufferGeometry().setFromPoints(
          curve.getPoints(48),
        );
        geometries.add(geometry);
        const options = {
          color: edge.highlighted ? "#962f2c" : "#7e8b7a",
          transparent: true,
          opacity: edge.highlighted ? 0.9 : 0.6,
        };
        const material = edge.disputed
          ? new THREE.LineDashedMaterial({
              ...options,
              dashSize: 0.14,
              gapSize: 0.1,
            })
          : new THREE.LineBasicMaterial(options);
        materials.add(material);
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        scene.add(line);
        lines.push({ line, edge, material });
      });
    }
    function draw() {
      frame = 0;
      if (!alive || document.hidden || latest.current.active === false) return;
      camera.position.set(
        position.x + pointer.x,
        position.y + pointer.y,
        position.z,
      );
      camera.lookAt(position.tx, position.ty, position.tz);
      camera.updateMatrixWorld();
      panels.forEach((panel) => panel.quaternion.copy(camera.quaternion));
      const projected = new THREE.Vector3();
      props.items.forEach((item) => {
        const element = labels.current.get(item.id);
        if (!element) return;
        projected.set(...item.position).project(camera);
        const x = ((projected.x + 1) * width) / 2,
          y = ((1 - projected.y) * height) / 2;
        const distance = camera.position.distanceTo(
          new THREE.Vector3(...item.position),
        );
        const current = item.id === latest.current.selectedId;
        const visible =
          projected.z < 1 &&
          projected.z > -1 &&
          x > -90 &&
          x < width + 90 &&
          y > -50 &&
          y < height + 80;
        const scale =
          props.mode === "timeline"
            ? Math.max(0.35, Math.min(1, 17 / distance))
            : Math.max(0.65, Math.min(1, 22 / distance));
        element.style.transform = `translate(${x}px, ${y}px) translate(${props.mode === "tree" ? "0" : "-50%"}, -50%) scale(${scale})`;
        element.style.visibility = visible ? "visible" : "hidden";
        element.style.opacity = current
          ? "1"
          : String(Math.max(0.32, 1 - distance / 140));
        element.style.zIndex = String(
          Math.max(1, 1000 - Math.round(distance * 3)),
        );
        element.inert = !visible;
        const bead = nodes.get(item.id);
        if (bead) {
          (bead.material as THREE.MeshStandardMaterial).color.set(
            current ? "#962f2c" : "#829083",
          );
          bead.scale.setScalar(current ? 1.6 : 1);
        }
      });
      generationLabels.current.forEach((element, generation) => {
        const item = props.items.find((item) => item.generation === generation);
        if (!item) return;
        projected.set(item.position[0], 7.5, item.position[2]).project(camera);
        element.style.transform = `translate(${((projected.x + 1) * width) / 2}px, ${((1 - projected.y) * height) / 2}px) translate(-50%, -50%)`;
        element.style.visibility =
          projected.z < 1 && projected.z > -1 ? "visible" : "hidden";
      });
      lines.forEach(({ line }) =>
        line.geometry.setDrawRange(
          0,
          Math.max(2, Math.ceil(49 * growth.value)),
        ),
      );
      renderer?.render(scene, camera);
    }
    function requestDraw() {
      if (alive && !frame) frame = requestAnimationFrame(draw);
    }
    function navigate() {
      const p = latest.current;
      gsap.killTweensOf(position);
      let target;
      if (p.mode === "timeline") {
        const t = timePoint(p.index ?? 0);
        target = {
          x: t.x + 4,
          y: 7.4,
          z: t.z + 17,
          tx: t.x,
          ty: 0.4,
          tz: t.z - 11,
        };
      } else {
        const view = p.view ?? { x: 0, y: 0, scale: 1 };
        target = {
          x: 5 - view.x / 70,
          y: 6 + view.y / 42,
          z: 25 / Math.max(0.15, view.scale),
          tx: -view.x / 70,
          ty: 0.5 + view.y / 42,
          tz: -3,
        };
      }
      if (still.current) {
        gsap.killTweensOf(growth);
        growth.value = 1;
        gsap.killTweensOf(pointer);
        pointer.x = pointer.y = 0;
      }
      if (
        still.current ||
        p.active === false ||
        document.hidden ||
        p.dragging
      ) {
        Object.assign(position, target);
        setMoving(false);
        requestDraw();
      } else {
        setMoving(true);
        gsap.to(position, {
          ...target,
          duration: 1.15,
          ease: "power3.inOut",
          onUpdate: requestDraw,
          onComplete: () => {
            if (alive) setMoving(false);
          },
        });
      }
    }
    controls.current = {
      navigate,
      draw: requestDraw,
      reset: () => {
        gsap.killTweensOf(pointer);
        pointer.x = pointer.y = 0;
        navigate();
      },
    };
    const resize = () => {
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer?.setSize(width, height, false);
      requestDraw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const onMove = (event: PointerEvent) => {
      if (still.current || event.pointerType === "touch" || event.buttons)
        return;
      const box = container.getBoundingClientRect();
      gsap.to(pointer, {
        x: ((event.clientX - box.left) / width - 0.5) * 0.45,
        y: -((event.clientY - box.top) / height - 0.5) * 0.18,
        duration: 0.7,
        overwrite: true,
        onUpdate: requestDraw,
      });
    };
    const leave = () => {
      gsap.to(pointer, {
        x: 0,
        y: 0,
        duration: 0.6,
        overwrite: true,
        onUpdate: requestDraw,
      });
    };
    const visibility = () => {
      if (document.hidden) {
        gsap.killTweensOf(pointer);
        gsap.getTweensOf(position).forEach((t) => t.progress(1));
      } else requestDraw();
    };
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", visibility);
    const lost = (event: Event) => {
      event.preventDefault();
      renderer = undefined;
      gpuBlocked.current = true;
      if (alive) setGpu("unavailable");
    };
    canvas.current?.addEventListener("webglcontextlost", lost);
    try {
      if (gpuBlocked.current) throw new Error("WebGL unavailable");
      renderer =
        rendererRef.current ??
        new THREE.WebGLRenderer({
          canvas: canvas.current!,
          antialias: true,
          alpha: false,
        });
      rendererRef.current = renderer;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      setGpu("ready");
    } catch {
      gpuBlocked.current = true;
      setGpu("unavailable");
    }
    resize();
    // Initial position is settled; subsequent user navigation is animated.
    const wasStill = still.current;
    if (!initializedWorld.current) still.current = true;
    navigate();
    initializedWorld.current = true;
    still.current = wasStill;
    if (!still.current) {
      growth.value = 0;
      gsap.to(growth, {
        value: 1,
        duration: 0.7,
        ease: "power2.out",
        onUpdate: requestDraw,
      });
    }
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      gsap.killTweensOf(position);
      gsap.killTweensOf(pointer);
      gsap.killTweensOf(growth);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", visibility);
      canvas.current?.removeEventListener("webglcontextlost", lost);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    };
  }, [props.items, props.links, props.mode]);
  useEffect(
    () => () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    },
    [],
  );
  useEffect(() => {
    controls.current.navigate();
  }, [
    props.index,
    props.selectedId,
    props.view,
    props.active,
    paused,
    reduced,
  ]);

  return (
    <div
      className={`ink-world ink-world--${props.mode}`}
      ref={host}
      data-renderer={gpu === "ready" ? "threejs" : "projection-fallback"}
      data-motion={moving ? "moving" : "settled"}
      tabIndex={0}
      aria-label={props.mode === "tree" ? "立体师承谱系" : "立体岁月长卷"}
      onKeyDown={props.onKeyDown}
      onPointerDown={(event) => {
        props.onPointerDown?.(event);
        if (
          props.mode !== "timeline" ||
          event.button !== 0 ||
          (event.target as Element).closest("button")
        )
          return;
        gesture.current = { x: event.clientX, index: props.index ?? 0 };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={props.onPointerMove}
      onPointerUp={(event) => {
        props.onPointerUp?.(event);
        const start = gesture.current;
        gesture.current = null;
        if (!start) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        const delta = event.clientX - start.x;
        if (Math.abs(delta) > 40) {
          const next = Math.max(
            0,
            Math.min(
              props.items.length - 1,
              start.index -
                Math.sign(delta) *
                  Math.max(1, Math.round(Math.abs(delta) / 100)),
            ),
          );
          if (props.items[next]) props.onSelect(props.items[next].id);
        }
      }}
      onPointerCancel={(event) => {
        gesture.current = null;
        props.onPointerUp?.(event);
      }}
    >
      <canvas
        ref={canvas}
        aria-hidden="true"
        style={{ visibility: gpu === "ready" ? "visible" : "hidden" }}
      />
      <div className="ink-world-heading">
        <h2>{props.mode === "timeline" ? "岁月入画" : "一脉千枝"}</h2>
        <p>
          {props.mode === "timeline"
            ? "相声百年 · 声传不绝"
            : "师承有绪 · 艺脉相传"}
        </p>
      </div>
      <div className="ink-world-labels">
        {generationItems.map((item) => (
          <span
            key={item.generation}
            className="ink-generation-title"
            ref={(element) => {
              if (element)
                generationLabels.current.set(item.generation!, element);
              else generationLabels.current.delete(item.generation!);
            }}
          >
            {item.generation}
            <small>字辈</small>
          </span>
        ))}
        {props.items.map((item) => (
          <div
            key={item.id}
            className={`ink-anchor ${props.mode === "timeline" ? "ink-event" : "ink-person"} ${props.selectedId === item.id ? "is-selected" : ""}`}
            ref={(element) => {
              if (element) labels.current.set(item.id, element);
              else labels.current.delete(item.id);
            }}
          >
            <button
              data-atlas-control="true"
              onClick={() => props.onSelect(item.id)}
              aria-current={props.selectedId === item.id ? "true" : undefined}
            >
              {item.subtitle && (
                <span className="ink-anchor-date">{item.subtitle}</span>
              )}
              <strong>{item.title}</strong>
              {item.status && <small>{item.status}</small>}
            </button>
            {item.branchLabel && props.onBranch && (
              <button
                data-atlas-control="true"
                className="ink-expand"
                aria-label={`${item.title}：${item.branchLabel}`}
                onClick={() => props.onBranch?.(item.id)}
              >
                <Plus size={12} />
                {item.branchLabel}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="ink-world-tools">
        <button
          data-atlas-control="true"
          aria-label="重置空间视角"
          onClick={() => controls.current.reset()}
        >
          <Crosshair size={16} />
        </button>
        <button
          data-atlas-control="true"
          aria-label={paused ? "恢复空间动效" : "暂停空间动效"}
          aria-pressed={paused || reduced}
          disabled={reduced}
          onClick={() => setPaused(!paused)}
        >
          {paused || reduced ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <span role="status">
          {gpu === "unavailable"
            ? "当前设备未启用 WebGL · 简化预览"
            : moving
              ? "移步中 · 可继续点选"
              : "点选浏览 · 鼠标轻移观景"}
        </span>
      </div>
    </div>
  );
}
