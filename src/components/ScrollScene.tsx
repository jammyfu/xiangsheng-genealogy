import { gsap } from "gsap";
import { createRoot, extend, useFrame, useThree } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  MutableRefObject,
  ReactNode,
  PointerEventHandler,
  KeyboardEventHandler,
} from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  PlaneGeometry,
  Vector3,
  SRGBColorSpace,
  DoubleSide,
  NoToneMapping,
  PerspectiveCamera,
  Line as ThreeLine,
  LineBasicMaterial,
  LineDashedMaterial,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  Group,
} from "three";
import { Pause, Play, Plus, Minus } from "@phosphor-icons/react";
import type {
  AtlasCamera,
  AtlasLayout,
  AtlasNode,
  AtlasViewport,
} from "../lib/atlas";
import {
  cameraDistance,
  constrainPointer,
  dampValue,
  isSelectionGesture,
  nodeDepth,
  perspectiveAnchor,
  scrollSurface,
} from "../lib/scroll-space";
import { sourcesById } from "../lib/catalog";
import "./scroll-scene.css";
import { revealScroll } from "../lib/motion";

extend({ AmbientLight, DirectionalLight, Mesh, MeshStandardMaterial, Group });

interface Props {
  graph: AtlasLayout;
  view: AtlasCamera;
  viewport: AtlasViewport;
  active: boolean;
  onSelect: (id: string) => void;
  onBranch: (node: AtlasNode) => void;
  onFocus: (node: AtlasNode) => void;
  onFailure: () => void;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}
export interface Motion {
  target: { x: number; y: number };
  pointer: { x: number; y: number };
  open: number;
  hovered: string | null;
  invalidate: () => void;
  moving: boolean;
}

class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function ScrollScene(props: Props) {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [unfolding, setUnfolding] = useState(false);
  const [visible, setVisible] = useState(
    () => document.visibilityState !== "hidden",
  );
  const down = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const change = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  const motion = useRef<Motion>({
    target: { x: 0, y: 0 },
    pointer: { x: 0, y: 0 },
    open: reduced ? 1 : 0.05,
    hovered: null,
    invalidate: () => {},
    moving: true,
  });
  const active = props.active && visible;
  const running = active && !paused && !reduced;
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(m.matches);
    m.addEventListener("change", change);
    return () => m.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    motion.current.target = { x: 0, y: 0 };
    motion.current.invalidate();
  }, [running]);
  useEffect(() => {
    if (!ready) return;
    const tween = revealScroll(motion.current, running);
    setUnfolding(Boolean(tween));
    tween?.eventCallback("onComplete", () => setUnfolding(false));
    return () => {
      tween?.kill();
    };
  }, [ready, running]);
  return (
    <div
      className={`scroll-space ${ready ? "is-ready" : ""} ${running ? "is-moving" : "is-still"}`}
      data-renderer="threejs"
      data-motion={running ? "interactive" : "still"}
      tabIndex={0}
      role="group"
      aria-label="立体山水长卷，师承方向从左至右"
      aria-describedby="atlas-instructions"
      onKeyDown={props.onKeyDown}
      onPointerDown={(event) => {
        down.current = { x: event.clientX, y: event.clientY };
        props.onPointerDown(event);
      }}
      onPointerMove={(event) => {
        props.onPointerMove(event);
        if (!running || event.pointerType === "touch") return;
        const r = event.currentTarget.getBoundingClientRect();
        motion.current.target = constrainPointer(
          ((event.clientX - r.left) / r.width) * 2 - 1,
          1 - ((event.clientY - r.top) / r.height) * 2,
        );
        motion.current.invalidate();
      }}
      onPointerLeave={() => {
        motion.current.target = { x: 0, y: 0 };
        motion.current.invalidate();
      }}
      onPointerUp={(event) => {
        props.onPointerUp(event);
        if (
          props.view.scale >= 0.65 ||
          (event.target as Element).closest("[data-atlas-control]") ||
          !isSelectionGesture(
            Math.hypot(
              event.clientX - down.current.x,
              event.clientY - down.current.y,
            ),
          )
        )
          return;
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left,
          y = event.clientY - rect.top;
        const nearest = props.graph.nodes.reduce<{
          node: AtlasNode;
          distance: number;
        } | null>((best, node) => {
          const distance = Math.hypot(
            node.x * props.view.scale + props.view.x - x,
            node.y * props.view.scale + props.view.y - y,
          );
          return distance < (best?.distance ?? 44) ? { node, distance } : best;
        }, null);
        if (nearest) {
          props.onFocus(nearest.node);
          props.onSelect(nearest.node.person.id);
        }
      }}
      onPointerCancel={props.onPointerUp}
    >
      {!ready && (
        <div className="scroll-loading" role="status">
          山水正在舒展
        </div>
      )}
      <SpatialCanvas
        {...props}
        active={active}
        motion={motion}
        running={running}
        onReady={() => setReady(true)}
      />
      <button
        className="scroll-motion-toggle"
        data-atlas-control="motion"
        aria-pressed={paused || reduced}
        aria-label={paused ? "开启展卷动效" : "静止阅读"}
        disabled={reduced}
        onClick={() => setPaused(!paused)}
      >
        {paused || reduced ? <Play size={13} /> : <Pause size={13} />}
        {paused || reduced ? "静止阅读" : "随光展卷"}
      </button>
      <ul className="sr-only" aria-label="历史师承与来源">
        {props.graph.edges.map((e) => (
          <li key={e.id}>
            {props.graph.nodes.find((n) => n.person.id === e.from)?.person.name}{" "}
            → {props.graph.nodes.find((n) => n.person.id === e.to)?.person.name}
            ；{e.disputed ? "存在不同说法；" : ""}
            {e.note} 来源：
            {e.sources.map((id) => sourcesById[id]?.title ?? id).join("；")}
          </li>
        ))}
      </ul>
      <div className="scroll-depth-note" aria-hidden="true">
        一纸山河 · 众声有序
      </div>
      {props.view.scale < 0.65 && !unfolding && (
        <div className="scroll-overview-note">全谱总览 · 点击支系放大阅读</div>
      )}
      {unfolding && (
        <div className="scroll-overview-note" role="status">
          长卷正在舒展 · 可直接拖动与选人
        </div>
      )}
    </div>
  );
}

type WorldProps = Props & {
  motion: MutableRefObject<Motion>;
  running: boolean;
  onReady: () => void;
};

/** Own renderer initialization so an asynchronous GPU failure has a real catch. */
function SpatialCanvas(props: WorldProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [root, setRoot] = useState<ReturnType<typeof createRoot> | null>(null);
  const camera = useMemo(() => {
    const result = new PerspectiveCamera(
      38,
      props.viewport.width / props.viewport.height,
      1,
      4000,
    );
    result.position.z = cameraDistance(props.viewport.height);
    return result;
  }, []);
  const settings = (p: WorldProps) => ({
    camera,
    flat: true,
    dpr: Math.min(window.devicePixelRatio || 1, 1.5),
    size: { ...p.viewport, top: 0, left: 0 },
    frameloop: p.active ? ("demand" as const) : ("never" as const),
    onCreated: (state: RootState) => {
      latest.current.motion.current.invalidate = state.invalidate;
    },
  });
  useEffect(() => {
    let disposed = false;
    let created: ReturnType<typeof createRoot> | null = null;
    let renderer: WebGLRenderer | null = null;
    // The deferred start skips React StrictMode's immediately cleaned-up probe.
    void Promise.resolve().then(async () => {
      if (disposed) return;
      try {
        renderer = new WebGLRenderer({
          canvas: canvas.current!,
          antialias: true,
          alpha: true,
        });
        renderer.toneMapping = NoToneMapping;
        created = createRoot(canvas.current!);
        const p = latest.current;
        await created.configure({
          ...settings(p),
          gl: renderer,
        });
        if (!disposed) setRoot(created);
      } catch {
        if (!disposed) latest.current.onFailure();
      }
    });
    return () => {
      disposed = true;
      created?.unmount();
      created = null;
      renderer?.dispose();
    };
  }, []);
  useEffect(() => {
    if (!root) return;
    let current = true;
    void root
      .configure(settings(props))
      .then(() => {
        if (!current) return;
        root.render(
          <SceneBoundary onFailure={props.onFailure}>
            <Suspense fallback={null}>
              <SpatialWorld {...props} />
            </Suspense>
          </SceneBoundary>,
        );
      })
      .catch(() => {
        if (current) props.onFailure();
      });
    return () => {
      current = false;
    };
  }, [root, props]);
  return (
    <div className="scroll-canvas-host">
      <canvas ref={canvas} aria-hidden="true" data-scroll-canvas="true" />
    </div>
  );
}

export function SpatialWorld({
  graph,
  view,
  viewport,
  motion,
  running,
  active,
  onSelect,
  onBranch,
  onFocus,
  onReady,
  onFailure,
}: Props & {
  motion: MutableRefObject<Motion>;
  running: boolean;
  onReady: () => void;
}) {
  const { camera, invalidate, gl } = useThree();
  useEffect(() => {
    motion.current.invalidate = invalidate;
  }, [motion, invalidate]);
  const selectedGen =
    graph.nodes.find((n) => n.selected)?.person.generationIndex ?? 6;
  const positions = useMemo(
    () => new Map(graph.nodes.map((n) => [n.person.id, new Vector3()])),
    [graph.nodes],
  );
  const lookup = useMemo(
    () => new Map(graph.nodes.map((n) => [n.person.id, n])),
    [graph.nodes],
  );
  const groupRefs = useRef(new Map<string, Group>());
  const depths = useRef(new Map<string, number>());
  const easedView = useRef({ ...view });
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    cam.position.set(0, 0, cameraDistance(viewport.height));
    cam.fov = 38;
    cam.near = 1;
    cam.far = 4000;
    cam.aspect = viewport.width / viewport.height;
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, viewport, invalidate]);
  useEffect(() => {
    invalidate();
  }, [graph, view, running, active, invalidate]);
  useEffect(() => {
    onReady();
  }, []);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      onFailure();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl, onFailure]);
  useFrame((_, dt) => {
    if (!active) return;
    const m = motion.current;
    const target = running ? m.target : { x: 0, y: 0 };
    const old = { ...m.pointer, open: m.open };
    m.pointer.x = running ? dampValue(m.pointer.x, target.x, dt, 6) : 0;
    m.pointer.y = running ? dampValue(m.pointer.y, target.y, dt, 6) : 0;
    // GSAP owns the reveal; frame callbacks must not compete for its value.
    if (!running) m.open = 1;
    m.moving =
      Math.abs(m.pointer.x - target.x) +
        Math.abs(m.pointer.y - target.y) +
        Math.abs(1 - m.open) >
      0.0008;
    let changed =
      Math.abs(old.x - m.pointer.x) +
        Math.abs(old.y - m.pointer.y) +
        Math.abs(old.open - m.open) >
      0.00001;
    const e = easedView.current;
    for (const key of ["x", "y", "scale"] as const) {
      // Moving the map follows the hand directly; do not animate a target away during acquisition.
      if (e[key] !== view[key]) changed = true;
      e[key] = view[key];
    }
    for (const n of graph.nodes) {
      const id = n.person.id;
      const overview = Math.min(1, Math.max(0, (e.scale - 0.22) / 0.6));
      const base = nodeDepth(n, selectedGen) * overview;
      const goal = base + (m.hovered === id && running ? 24 : 0);
      const z = running
        ? dampValue(depths.current.get(id) ?? base, goal, dt, 9)
        : base;
      depths.current.set(id, z);
      if (Math.abs(z - goal) > 0.04) m.moving = true;
      // Projected slots stay faithful to the genealogy layout. Depth adds bounded parallax only.
      const px =
        n.x * e.scale + e.x + m.pointer.x * (base / 75) * 10 * overview;
      const py = n.y * e.scale + e.y - m.pointer.y * (base / 75) * 7 * overview;
      const anchor = perspectiveAnchor(
        px,
        py,
        z,
        viewport.width,
        viewport.height,
      );
      positions.get(id)!.set(anchor.x, anchor.y, anchor.z);
      const g = groupRefs.current.get(id);
      if (g) g.position.copy(positions.get(id)!);
    }
    if (m.moving || changed) invalidate();
  }, -2);
  const hover = (id: string | null) => {
    motion.current.hovered = id;
    invalidate();
  };
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[-350, 500, 900]}
        intensity={0.75}
        color="#fffdf6"
      />
      <PaperSurface viewport={viewport} motion={motion} />
      {graph.edges.map((edge) => (
        <SpatialEdge
          key={edge.id}
          edge={edge}
          from={lookup.get(edge.from)!}
          to={lookup.get(edge.to)!}
          positions={positions}
          motion={motion}
          scale={view.scale}
          running={running}
        />
      ))}
      {graph.nodes.map((node) => (
        <group
          key={node.person.id}
          name={`person:${node.person.id}`}
          ref={(g) => {
            if (g) groupRefs.current.set(node.person.id, g);
            else groupRefs.current.delete(node.person.id);
          }}
        >
          <Html
            transform
            sprite
            distanceFactor={400}
            zIndexRange={[18, 5]}
            wrapperClass="spatial-label-anchor"
            style={{ pointerEvents: "none" }}
          >
            <SpatialPerson
              node={node}
              scale={view.scale}
              onSelect={onSelect}
              onBranch={onBranch}
              onFocus={onFocus}
              hover={hover}
            />
          </Html>
        </group>
      ))}
    </>
  );
}

function PaperSurface({
  viewport,
  motion,
}: {
  viewport: AtlasViewport;
  motion: MutableRefObject<Motion>;
}) {
  const texture = useTexture("/assets/landscape.webp");
  useMemo(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
  }, [texture]);
  const geometry = useMemo(() => new PlaneGeometry(2, 2, 112, 28), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const pos = geometry.attributes.position,
      uv = geometry.attributes.uv;
    const m = motion.current;
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i) * 2 - 1,
        v = uv.getY(i) * 2 - 1;
      const p = scrollSurface(u, v, m.pointer, m.open);
      pos.setXYZ(
        i,
        p.x * viewport.width * 0.515,
        p.y * viewport.height * 0.48 - 5,
        p.z * viewport.height * 0.75 - 105,
      );
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  }, -1);
  return (
    <mesh geometry={geometry} name="ink-scroll">
      <meshStandardMaterial
        map={texture}
        color="#fffdf5"
        roughness={1}
        metalness={0}
        side={DoubleSide}
      />
    </mesh>
  );
}

function SpatialEdge({
  edge,
  from,
  to,
  positions,
  motion,
  scale,
  running,
}: {
  edge: AtlasLayout["edges"][number];
  from: AtlasNode;
  to: AtlasNode;
  positions: Map<string, Vector3>;
  motion: MutableRefObject<Motion>;
  scale: number;
  running: boolean;
}) {
  const growth = useRef({ value: 0 });
  useEffect(() => {
    const state = growth.current;
    if (!running) {
      state.value = 1;
      motion.current.invalidate();
      return;
    }
    const tween = gsap.to(state, {
      value: 1,
      duration: 0.55,
      ease: "power2.out",
      onUpdate: () => motion.current.invalidate(),
    });
    return () => {
      tween.kill();
    };
  }, [running, motion]);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(33 * 3), 3),
    );
    g.setAttribute(
      "lineDistance",
      new Float32BufferAttribute(new Float32Array(33), 1),
    );
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const material = useMemo(
    () =>
      edge.disputed
        ? new LineDashedMaterial({
            color: "#957459",
            transparent: true,
            opacity: 0.45,
            dashSize: 5,
            gapSize: 5,
          })
        : new LineBasicMaterial({
            color: edge.highlighted ? "#8b2626" : "#738577",
            transparent: true,
            opacity: 0.4,
          }),
    [edge.disputed, edge.highlighted],
  );
  const line = useMemo(
    () => new ThreeLine(geometry, material),
    [geometry, material],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    const a = positions.get(edge.from),
      b = positions.get(edge.to);
    if (!a || !b) return;
    const p = geometry.attributes.position;
    const forward = to.x >= from.x ? 1 : -1;
    // Labels now have real perspective size, so their edges are world offsets.
    const ax = a.x + (from.width / 2) * scale * forward,
      bx = b.x - (to.width / 2) * scale * forward;
    for (let i = 0; i < 33; i++) {
      const t = i / 32,
        s = 1 - t,
        mid = from.x === to.x ? Math.max(ax, bx) + 48 * scale : (ax + bx) / 2;
      p.setXYZ(
        i,
        s * s * s * ax +
          3 * s * s * t * mid +
          3 * s * t * t * mid +
          t * t * t * bx,
        s * s * s * a.y +
          3 * s * s * t * a.y +
          3 * s * t * t * b.y +
          t * t * t * b.y,
        a.z + (b.z - a.z) * t - 3,
      );
    }
    p.needsUpdate = true;
    geometry.setDrawRange(0, Math.max(2, Math.ceil(33 * growth.current.value)));
    geometry.computeBoundingSphere();
    if (edge.disputed) {
      const distances = geometry.attributes.lineDistance;
      distances.setX(0, 0);
      for (let i = 1; i < 33; i++)
        distances.setX(
          i,
          distances.getX(i - 1) +
            Math.hypot(
              p.getX(i) - p.getX(i - 1),
              p.getY(i) - p.getY(i - 1),
              p.getZ(i) - p.getZ(i - 1),
            ),
        );
      distances.needsUpdate = true;
    }
    if (material) {
      const near =
        motion.current.hovered === edge.from ||
        motion.current.hovered === edge.to;
      material.opacity = near
        ? 0.9
        : from.dimmed || to.dimmed
          ? 0.12
          : edge.highlighted
            ? 0.72
            : 0.36;
    }
  }, -1);
  return <primitive object={line} />;
}

function SpatialPerson({
  node,
  scale,
  onSelect,
  onBranch,
  onFocus,
  hover,
}: {
  node: AtlasNode;
  scale: number;
  onSelect: Props["onSelect"];
  onBranch: Props["onBranch"];
  onFocus: Props["onFocus"];
  hover: (id: string | null) => void;
}) {
  const down = useRef({ x: 0, y: 0 });
  const p = node.person;
  const isOpen = node.hiddenChildren === 0;
  const label = `${p.name}，${p.generation ? `${p.generation}字辈` : "字辈待考"}${p.disputed ? "，资料存在不同说法" : ""}，查看人物`;
  const sources = p.sources
    .map((id) => sourcesById[id]?.title ?? id)
    .join("；");
  return (
    <div
      className={`spatial-person ${node.selected ? "is-selected" : ""} ${node.dimmed ? "is-dimmed" : ""}`}
      style={{ transform: `scale(${scale})`, width: node.width }}
    >
      <button
        data-atlas-control="person"
        data-person-id={p.id}
        className="spatial-person-name"
        aria-label={label}
        aria-pressed={node.selected}
        title={`${p.name}。来源：${sources}`}
        onPointerEnter={() => hover(p.id)}
        onPointerLeave={() => hover(null)}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) onFocus(node);
          hover(p.id);
        }}
        onBlur={() => hover(null)}
        onPointerDown={(e) => {
          down.current = { x: e.clientX, y: e.clientY };
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (
            e.detail === 0 ||
            isSelectionGesture(
              Math.hypot(
                e.clientX - down.current.x,
                e.clientY - down.current.y,
              ),
            )
          )
            onSelect(p.id);
        }}
      >
        <span>{p.name}</span>
        {!node.selected && (
          <small>
            {p.generation ? `${p.generation}字辈` : "字辈待考"}
            {p.disputed ? " · 存疑" : ""}
          </small>
        )}
      </button>
      {node.selected && (
        <span className="spatial-caption">
          {p.generation ? `${p.generation}字辈` : "字辈待考"} · 当前人物
        </span>
      )}
      {node.childCount > 0 && scale >= 0.65 && (
        <button
          data-atlas-control="branch"
          className="spatial-branch"
          aria-expanded={isOpen}
          aria-label={`${isOpen ? "收起" : "展开"}${p.name}的弟子分支${node.hiddenChildren ? `，另有 ${node.hiddenChildren} 人` : ""}`}
          onFocus={(e) => {
            if (e.currentTarget.matches(":focus-visible")) onFocus(node);
          }}
          onClick={(e) => {
            e.stopPropagation();
            onBranch(node);
          }}
        >
          {isOpen ? <Minus size={13} /> : <Plus size={13} />}{" "}
          {node.hiddenChildren > 0 && <small>{node.hiddenChildren}</small>}
        </button>
      )}
    </div>
  );
}
