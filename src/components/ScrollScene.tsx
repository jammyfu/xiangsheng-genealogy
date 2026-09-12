import { branchLayout } from "../lib/branch-layout";
import { focusCloud, type ReadingSlot } from '../lib/focus-cloud';
import { lineageComparison } from "../lib/lineage-focus";
import { clusterAngle, clusterPoint } from "../lib/cluster-space";
import { layoutCluster, nameSlipHeight } from "../lib/cluster-layout";
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
  Vector4,
  SRGBColorSpace,
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
  scrollPointerFromClient,
  dampValue,
  isSelectionGesture,
  nodeDepth,
  perspectiveAnchor,
  scrollSurface,
} from "../lib/scroll-space";
import {
  createPaperGeometry,
  createPaintedPaperMaterial,
  paintingWindow,
} from "../lib/scroll-paper";
import { sourcesById } from "../lib/catalog";
import "./scroll-scene.css";
import { SceneryLayers } from "./SceneryLayers";
import { revealScroll } from "../lib/motion";

extend({ AmbientLight, DirectionalLight, Mesh, MeshStandardMaterial, Group });

interface Props {
  readable?: boolean;
  graph: AtlasLayout;
  view: AtlasCamera;
  viewport: AtlasViewport;
  active: boolean;
  onSelect: (id: string) => void;
  onBranch: (node: AtlasNode) => void;
  onFocus: (node: AtlasNode) => void;
  onFailure: () => void;
  onPointerDown: (
    event: Parameters<PointerEventHandler<HTMLDivElement>>[0],
    displayed?: AtlasCamera,
  ) => void;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
}
export interface Motion {
  target: { x: number; y: number };
  pointer: { x: number; y: number };
  open: number;
  hovered: string | null;
  comparisonLinks?: Set<string>;
  invalidate: () => void;
  moving: boolean;
  navigationInterrupted?: boolean;
  requestTravel?: boolean;
  deckMoving?: boolean;
  displayedView?: AtlasCamera;
  clusterPointer?: { x: number; y: number };
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
  const orderedNames = useMemo(
    () =>
      props.graph.fixed
        ? props.graph.nodes
        : [...props.graph.nodes].sort((a, b) => a.x - b.x || a.y - b.y),
    [props.graph.nodes],
  );
  const currentIndex = Math.max(
    0,
    orderedNames.findIndex((n) => n.selected),
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
        motion.current.navigationInterrupted = true;
        down.current = { x: event.clientX, y: event.clientY };
        props.onPointerDown(event, motion.current.displayedView);
      }}
      onPointerMove={(event) => {
        props.onPointerMove(event);
        if (!running || event.pointerType === "touch") return;
        const r = event.currentTarget.getBoundingClientRect();
        const pointer = scrollPointerFromClient(event.clientX, event.clientY, r);
        if (props.graph.fixed) motion.current.clusterPointer = pointer;
        motion.current.target = pointer;
        motion.current.invalidate();
      }}
      onPointerLeave={() => {
        motion.current.target = { x: 0, y: 0 };
        motion.current.clusterPointer = { x: 0, y: 0 };
        motion.current.invalidate();
      }}
      onPointerUp={(event) => {
        props.onPointerUp(event);
        if (
          props.readable || props.view.scale >= 0.65 ||
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
        {paused || reduced
          ? "静止阅读"
          : props.graph.fixed
            ? "平滑移卷"
            : "随光展卷"}
      </button>
      <nav
        className="scroll-travel-controls"
        aria-label="长卷行进"
        data-atlas-control="travel"
      >
        <button
          disabled={currentIndex === 0}
          onClick={() => props.onSelect(orderedNames[0].person.id)}
        >
          卷首
        </button>
        <button
          disabled={currentIndex === 0}
          onClick={() =>
            props.onSelect(orderedNames[currentIndex - 1].person.id)
          }
        >
          ← 向左
        </button>
        <span aria-live="polite">
          {currentIndex + 1} / {orderedNames.length}
        </span>
        <button
          disabled={currentIndex === orderedNames.length - 1}
          onClick={() =>
            props.onSelect(orderedNames[currentIndex + 1].person.id)
          }
        >
          向右 →
        </button>
        <button
          disabled={currentIndex === orderedNames.length - 1}
          onClick={() =>
            props.onSelect(orderedNames[orderedNames.length - 1].person.id)
          }
        >
          卷末
        </button>
      </nav>
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
      {!props.readable && props.view.scale < 0.65 && !unfolding && (
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
    dpr: Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(2_500_000 / Math.max(1, p.viewport.width * p.viewport.height))),
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
  readable = false,
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
  const selectedNode = graph.nodes.find((n) => n.selected);
  const selectedPath = useMemo(() => lineageComparison(selectedNode?.person.id ?? '', null, graph.edges).selected, [selectedNode?.person.id, graph.edges]);
  const [hoveredPerson, setHoveredPerson] = useState<string | null>(null);
  const paths = useMemo(() => lineageComparison(selectedNode?.person.id ?? "", hoveredPerson, graph.edges), [selectedNode?.person.id, hoveredPerson, graph.edges]);
  useEffect(() => { motion.current.comparisonLinks = paths.compared.links; invalidate(); }, [paths, invalidate, motion]);
  const clusterLayouts = useMemo(() => new Map(graph.columns.map(column => [column.index,
    layoutCluster(graph.nodes.filter(n => n.person.generationIndex === column.index)
      .sort((a, b) => (a.deckOrdinal ?? 0) - (b.deckOrdinal ?? 0)).map(n => n.person.name), viewport.height),
  ])), [graph.nodes, graph.columns, viewport.height]);
  const clusterNameScale = (generation: number) => clusterLayouts.get(generation)?.scale ?? 1;
  const reading = useMemo(() => readable ? focusCloud(graph, selectedPath.nodes, viewport, view.scale) : { slots: new Map<string, ReadingSlot>(), spine: new Set<string>(), hidden: 0 }, [readable, graph, selectedPath, viewport.width, viewport.height, view.scale]);
  const branchSlots = useMemo(() => readable ? reading.slots : branchLayout(graph, paths.selected.nodes, viewport.height), [readable, reading, graph, paths.selected.nodes, viewport.height]);
  const panelCenterY = viewport.height * (readable ? 0.46 : 0.40);
  const [openedGeneration, setOpenedGeneration] = useState(selectedGen);
  useEffect(() => { setOpenedGeneration(selectedGen); }, [selectedNode?.person.id]);
  const shownNames = new Set(graph.nodes.filter(n => !graph.fixed || !readable || branchSlots.has(n.person.id)).map(n => n.person.id));
  const deckRefs = useRef(new Map<number, Group>());
  const clusterRotations = useRef(new Map<number, number>());
  const settledLayout = useRef<{ graph: typeof graph; key: string } | null>(null);
  useEffect(() => { invalidate(); }, [openedGeneration, invalidate]);
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
  // Keep screen-space positions across layout rebuilds so a selected name can
  // travel from the place the reader clicked, including across generations.
  const displayedSlots = useRef(new Map<string, { x: number; y: number }>());
  const selection = useRef(graph.nodes.find((n) => n.selected)?.person.id);
  const journey = useRef<{
    elapsed: number;
    from: Map<string, { x: number; y: number }>;
    view: AtlasCamera;
  } | null>(null);
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
    const layoutKey = [readable, view.x, view.y, view.scale, viewport.width, viewport.height,
      running, openedGeneration, m.hovered, m.target.x, m.target.y, m.clusterPointer?.x,
      m.clusterPointer?.y, m.open, m.navigationInterrupted].join(",");
    if (!m.moving && !journey.current && !m.requestTravel &&
      settledLayout.current?.graph === graph && settledLayout.current.key === layoutKey) return;
    settledLayout.current = { graph, key: layoutKey };
    const selected = graph.nodes.find((n) => n.selected)?.person.id;
    if (selection.current !== selected || m.requestTravel) {
      m.requestTravel = false;
      selection.current = selected;
      m.navigationInterrupted = false;
      journey.current = {
        elapsed: 0,
        from: new Map(displayedSlots.current),
        view: { ...easedView.current },
      };
    }
    if (!running || m.navigationInterrupted) journey.current = null;
    const trip = journey.current;
    if (trip) trip.elapsed = Math.min(0.85, trip.elapsed + dt);
    const progress = trip ? trip.elapsed / 0.85 : 1;
    const travel = progress * progress * (3 - 2 * progress);
    const target = running ? (graph.fixed ? m.clusterPointer ?? m.target : m.target) : { x: 0, y: 0 };
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
      e[key] = trip
        ? trip.view[key] + (view[key] - trip.view[key]) * travel
        : view[key];
    }
    m.displayedView = e;
    for (const column of graph.columns) {
      const focused = graph.nodes.find(n => n.selected && n.person.generationIndex === column.index);
      const targetRotation = (focused ? -clusterAngle(focused.deckOrdinal ?? 0) : 0)
        + (running && openedGeneration === column.index ? m.pointer.x * 0.16 : 0);
      const rotation = running ? dampValue(clusterRotations.current.get(column.index) ?? 0, targetRotation, dt, 5) : targetRotation;
      clusterRotations.current.set(column.index, rotation);
      if (Math.abs(rotation - targetRotation) > 0.0001) m.moving = true;
      const deck = deckRefs.current.get(column.index);
      if (deck) {
        const anchor = perspectiveAnchor(
          column.x * e.scale + e.x + (graph.fixed ? m.pointer.x * 9 : 0),
          (graph.fixed ? viewport.height * .10 : panelCenterY + ((clusterLayouts.get(column.index)?.top ?? 0) - 54) * e.scale) - (graph.fixed ? m.pointer.y * 6 : 0),
          cameraDistance(viewport.height) *
            (openedGeneration === column.index ? 0.05 : -0.22),
          viewport.width,
          viewport.height,
        );
        deck.position.set(anchor.x, anchor.y, anchor.z);
      }
    }
    const projected = new Map<string, { x: number; y: number; z: number }>();
    for (const n of graph.nodes) {
      const id = n.person.id;
      const overview = Math.min(1, Math.max(0, (e.scale - 0.22) / 0.6));
      const slot = graph.fixed ? branchSlots.get(id) : undefined;
      const base =
        (n.focusDepth === undefined
          ? nodeDepth(n, selectedGen)
          : cameraDistance(viewport.height) *
            (graph.fixed && !slot?.rear && (n.person.generationIndex === openedGeneration || paths.selected.nodes.has(id))
              ? Math.max(0.06, n.focusDepth)
              : n.focusDepth)) * overview;
      const orbit = clusterPoint(n.deckOrdinal ?? 0, clusterRotations.current.get(n.person.generationIndex) ?? 0);
      const orbitDepth = graph.fixed && !slot?.trunk ? orbit.z * (slot?.rear ? .55 : .08) * overview : 0;
      const goal = base + orbitDepth + (m.hovered === id && running ? 24 : 0);
      const z = readable ? 0 : running
        ? dampValue(depths.current.get(id) ?? base, goal, dt, 9)
        : base;
      depths.current.set(id, z);
      if (!readable && Math.abs(z - goal) > 0.04) m.moving = true;
      // Projected slots stay faithful to the genealogy layout. Depth adds bounded parallax only.
      let px =
        (n.x + (slot ? slot.x + (slot.rear ? orbit.x * .12 : 0) : 0)) *
          view.scale +
        view.x;
      let py = graph.fixed
        ? panelCenterY + (slot?.y ?? 0) * view.scale
        : n.y * view.scale + view.y;
      if (readable && slot) { px = slot.x; py = slot.y; }
      const origin = trip?.from.get(id);
      if (origin) {
        px = origin.x + (px - origin.x) * travel;
        py = origin.y + (py - origin.y) * travel;
      }
      if (readable && slot) {
        const box = reading.slots.get(id)!;
        px = Math.max(box.width / 2 + 18, Math.min(viewport.width - box.width / 2 - 18, px));
        py = Math.max(box.height / 2 + Math.min(170, viewport.height * .31), Math.min(viewport.height - box.height / 2 - 112, py));
      }
      projected.set(id, { x: px, y: py, z });
    }
    for (const n of graph.nodes) {
      const id = n.person.id;
      const { x: px, y: py, z } = projected.get(id)!;
      displayedSlots.current.set(id, { x: px, y: py });
      const depthParallax = Math.max(.55, Math.min(1.3, 1 + z / cameraDistance(viewport.height) * .9));
      const anchor = perspectiveAnchor(
        px + (graph.fixed && !readable ? m.pointer.x * 12 * depthParallax : 0),
        py - (graph.fixed && !readable ? m.pointer.y * 9 * depthParallax : 0),
        z,
        viewport.width,
        viewport.height,
      );
      positions.get(id)!.set(anchor.x, anchor.y, anchor.z);
      const g = groupRefs.current.get(id);
      if (g) {
        g.position.copy(positions.get(id)!);
        // Html's local scale follows the same eased camera as its row spacing.
        g.scale.setScalar(graph.fixed && !readable ? e.scale / view.scale : 1);
      }
      if (graph.fixed && !shownNames.has(id)) {
        const column = graph.columns.find(
          (c) => c.index === n.person.generationIndex,
        );
        const deck = column && deckRefs.current.get(column.index);
        if (deck) positions.get(id)!.copy(deck.position);
      }
    }
    for (const id of displayedSlots.current.keys()) {
      if (!lookup.has(id)) displayedSlots.current.delete(id);
    }
    if (trip && progress < 1) m.moving = true;
    else { journey.current = null; m.deckMoving = false; }
    if (m.moving || changed) invalidate();
  }, -2);
  const hover = (id: string | null) => {
    setHoveredPerson(id);
    motion.current.hovered = id;
    invalidate();
  };
  return (
    <>
      <ambientLight intensity={2.5} />
      <directionalLight
        position={[-350, 500, 900]}
        intensity={1.1}
        color="#fffdf6"
      />
      <PaperSurface
        viewport={viewport}
        motion={motion}
        view={view}
        worldBounds={graph.bounds}
        running={running}
        active={active}
      />
      <SceneryLayers
        viewport={viewport}
        view={view}
        motion={motion}
        worldBounds={graph.bounds}
        running={running}
        active={active}
      />
      {graph.edges
        .filter((edge) => shownNames.has(edge.from) && shownNames.has(edge.to))
        .filter((edge) => !readable || edge.highlighted || paths.compared.links.has(edge.id))
        .map((edge) => (
          <SpatialEdge
            underLabels={readable}
            key={edge.id}
            edge={readable ? { ...edge, highlighted: edge.highlighted && reading.spine.has(edge.from) && reading.spine.has(edge.to) } : edge}
            from={lookup.get(edge.from)!}
            to={lookup.get(edge.to)!}
            positions={positions}
            motion={motion}
            scale={readable ? .45 : view.scale}
            running={running}
          />
        ))}
      {graph.fixed && !readable &&
        graph.columns.map((column) => {
          const cohort = graph.nodes.filter(
            (n) => n.person.generationIndex === column.index,
          );
          const open = openedGeneration === column.index;
          const reveal = () => {
            if (open || motion.current.deckMoving) return;
            setOpenedGeneration(column.index);
            motion.current.requestTravel = true;
            motion.current.deckMoving = true;
            motion.current.navigationInterrupted = false;
            onFocus(cohort[0]);
            invalidate();
          };
          return (
            <group
              key={`deck-${column.index}`}
              name={`generation-deck:${column.index}`}
              ref={(group) => {
                if (group) deckRefs.current.set(column.index, group);
                else deckRefs.current.delete(column.index);
              }}
            >
              <Html center zIndexRange={[4, 1]}>
                <section
                  className={`generation-deck generation-cluster ${open ? "is-open" : ""}`}
                  style={{ transform: `scale(${view.scale})` }}
                  data-atlas-control="generation"
                >
                  <button
                    onClick={reveal}
                    aria-pressed={open}
                    aria-label={`靠近${column.label}辈分人名簇，共${cohort.length}人`}
                  >
                    <strong>
                      {column.label}
                      {column.label === "世代待考" || column.label.endsWith("代") ? "" : "字辈"}
                    </strong>
                    <span>
                      {`${cohort.length} 人 · ${open ? '当前近览' : '点击近览'}`}
                    </span>
                  </button>
                </section>
              </Html>
            </group>
          );
        })}
      {graph.nodes.map((node) => (
        <group
          key={node.person.id}
          name={`person:${node.person.id}`}
          ref={(g) => {
            if (g) groupRefs.current.set(node.person.id, g);
            else groupRefs.current.delete(node.person.id);
          }}
        >
          {shownNames.has(node.person.id) && (
            <Html
              transform={!readable}
              sprite={!readable}
              center={readable}
              distanceFactor={readable ? undefined : 400}
              zIndexRange={hoveredPerson === node.person.id ? [28, 28] : node.selected ? [26, 26] : [18, 5]}
              wrapperClass="spatial-label-anchor"
              style={{ pointerEvents: "none" }}
            >
              <SpatialPerson
                readable={readable}
                cloudContext={readable && !reading.spine.has(node.person.id)}
                node={node}
                allowCollapse={!graph.fixed}
                compact={viewport.height < 700}
                lineage={paths.selected.nodes.has(node.person.id)}
                compared={paths.compared.nodes.has(node.person.id)}
                shared={paths.sharedNodes.has(node.person.id)}
                scale={(readable ? 1 : view.scale) * (graph.fixed ? (branchSlots.get(node.person.id)?.scale ?? clusterNameScale(node.person.generationIndex)) : 1)}
                onSelect={onSelect}
                onBranch={onBranch}
                onFocus={onFocus}
                hover={hover}
              />
            </Html>
          )}
        </group>
      ))}
      {readable && <Html fullscreen zIndexRange={[29, 29]} style={{ pointerEvents: 'none' }}>
        <div className="focus-cloud-guide"><strong>上溯师门 ← 一脉居中 → 下传弟子</strong></div>
        <p className="focus-cloud-count" role="status">当前展开 {reading.slots.size} 人 · 其余 {reading.hidden} 人收纳于人名册</p>
      </Html>}
    </>
  );
}

function PaperSurface({
  worldBounds,
  viewport,
  motion,
  view,
  active,
  running,
}: {
  viewport: AtlasViewport;
  motion: MutableRefObject<Motion>;
  view: AtlasCamera;
  active: boolean;
  running: boolean;
  worldBounds: { x: number; width: number };
}) {
  const { invalidate } = useThree();
  // Ambient water needs only 30 fps; interaction keeps its own demand frames.
  useEffect(() => {
    if (!running || !active) return;
    const timer = setInterval(invalidate, 1000 / 30);
    return () => clearInterval(timer);
  }, [running, active, invalidate]);
  const source = useTexture("/assets/spatial/river-paper-water.png");
  const texture = useMemo(() => {
    const t = source.clone();
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }, [source]);
  const window = useMemo(() => new Vector4(0, 0, 1, 1), []);
  const geometry = useMemo(() => createPaperGeometry(), []);
  const background = useMemo(() => new PlaneGeometry(2, 2), []);
  const front = useMemo(
    () => createPaintedPaperMaterial(texture, window, 0.82),
    [texture, window],
  );
  const behind = useMemo(
    () => new MeshStandardMaterial({ color: "#fffaf0", roughness: 1 }),
    [],
  );
  const back = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#e8dac0",
        roughness: 1,
        metalness: 0,
      }),
    [],
  );
  const lastFrame = useRef("");
  useEffect(
    () => () => {
      geometry.dispose();
      background.dispose();
      texture.dispose();
      front.dispose();
      behind.dispose();
      back.dispose();
    },
    [geometry, background, texture, front, behind, back],
  );
  useFrame((_, dt) => {
    if (!active) return;
    if (running) {
      front.userData.waterTime.value += Math.min(dt, .1);
    }
    const m = motion.current;
    const displayed = m.displayedView ?? view;
    const frameKey = [
      viewport.width,
      viewport.height,
      m.pointer.x,
      m.pointer.y,
      m.open,
      displayed.x,
      displayed.scale,
    ].join(":");
    if (lastFrame.current === frameKey) return;
    lastFrame.current = frameKey;
    const paperWidth = viewport.width * 1.12;
    const paperHeight = viewport.height * 0.93;
    const crop = paintingWindow(paperWidth, paperHeight, displayed.x);
    const extent = worldBounds.width + viewport.width;
    crop.z = Math.min(1, paperWidth / displayed.scale / extent);
    crop.x = Math.max(
      0,
      Math.min(
        1 - crop.z,
        (-displayed.x / displayed.scale -
          worldBounds.x +
          viewport.width * 0.5) /
          extent,
      ),
    );
    const revealed = 0.58 + 0.42 * m.open;
    crop.x += crop.z * (1 - revealed) * 0.5;
    crop.z *= revealed;
    // Moving a sampling window shifts the painted image in the opposite
    // direction, so UV offsets invert the shared world-space displacement.
    crop.x = Math.max(0, Math.min(1 - crop.z, crop.x - m.pointer.x * .004));
    crop.y = Math.max(0, Math.min(1 - crop.w, crop.y - m.pointer.y * .008));
    window.copy(crop);
    const pos = geometry.attributes.position,
      uv = geometry.attributes.uv,
      sides = geometry.attributes.paperSide;
    for (let i = 0; i < pos.count; i++) {
      const p = scrollSurface(
        uv.getX(i) * 2 - 1,
        uv.getY(i) * 2 - 1,
        m.pointer,
        m.open,
      );
      pos.setXYZ(
        i,
        (p.x * paperWidth) / 2,
        (p.y * paperHeight) / 2 - viewport.height * 0.025,
        p.z * viewport.height * 0.9 - 100 + sides.getX(i) * 0.7,
      );
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    // The distant painting samples the same sheet coordinates, including pan
    // and reveal. Perspective compensation aligns its flat region with paper.
    const distance = cameraDistance(viewport.height);
    const positions = background.attributes.position,
      coords = background.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
      const sx = (i % 2 === 0 ? -1 : 1) * viewport.width * 0.56;
      const sy = (i < 2 ? 1 : -1) * viewport.height * 0.56;
      positions.setXYZ(
        i,
        (sx * (distance + 300)) / distance,
        (sy * (distance + 300)) / distance,
        -300,
      );
      coords.setXY(
        i,
        0.5 + (sx * (distance + 100)) / distance / paperWidth,
        0.5 +
          ((sy * (distance + 100)) / distance + viewport.height * 0.025) /
            paperHeight,
      );
    }
    positions.needsUpdate = true;
    coords.needsUpdate = true;
    background.computeBoundingSphere();
  }, -1);
  return (
    <>
      <mesh
        geometry={background}
        material={behind}
        name="unpainted-paper-backdrop"
      />
      <mesh geometry={geometry} material={[front, back]} name="ink-scroll" />
    </>
  );
}

function SpatialEdge({
  underLabels = false,
  edge,
  from,
  to,
  positions,
  motion,
  scale,
  running,
}: {
  edge: AtlasLayout["edges"][number];
  underLabels?: boolean;
  from: AtlasNode;
  to: AtlasNode;
  positions: Map<string, Vector3>;
  motion: MutableRefObject<Motion>;
  scale: number;
  running: boolean;
}) {
  const { camera, size } = useThree();
  const foregroundPath = useRef<SVGPolylineElement>(null);
  const projectedPoint = useMemo(() => new Vector3(), []);
  const foreground = !underLabels && Boolean(from.focusRole && edge.highlighted);
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
            depthTest: !from.focusRole,
            depthWrite: false,
            dashSize: 5,
            gapSize: 5,
          })
        : new LineBasicMaterial({
            color: edge.highlighted ? "#8b2626" : "#738577",
            transparent: true,
            opacity: 0.4,
            depthTest: !from.focusRole,
            depthWrite: false,
          }),
    [edge.disputed, edge.highlighted],
  );
  const line = useMemo(
    () => new ThreeLine(geometry, material),
    [geometry, material],
  );
  useEffect(() => () => material.dispose(), [material]);
  const previousEdgeFrame = useRef("");
  useFrame(() => {
    const a = positions.get(edge.from),
      b = positions.get(edge.to);
    if (!a || !b) return;
    const frameKey = [a.x, a.y, a.z, b.x, b.y, b.z, scale,
      growth.current.value, edge.highlighted, edge.disputed, from.dimmed, to.dimmed,
      motion.current.comparisonLinks?.has(edge.id), size.width, size.height,
      from.width, to.width, from.x, to.x, foreground,
      ...camera.matrixWorldInverse.elements, ...camera.projectionMatrix.elements].join(",");
    if (previousEdgeFrame.current === frameKey) return;
    previousEdgeFrame.current = frameKey;
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
      const comparing = motion.current.comparisonLinks?.has(edge.id);
      material.color.set(edge.highlighted && comparing ? '#77549c' : edge.highlighted ? (edge.disputed ? '#a36922' : '#8b2626') : comparing ? '#197c85' : '#819186');
      material.opacity = edge.highlighted || comparing ? 1 : from.dimmed || to.dimmed ? .08 : .12;
    }
    // WebGL is below every Html name slip. Project the same animated geometry
    // into a pointer-transparent DOM layer so the selected path crosses slips.
    const overlay = foregroundPath.current;
    if (overlay) {
      const count = Math.max(2, Math.ceil(33 * growth.current.value));
      const points: string[] = [];
      for (let i = 0; i < count; i++) {
        projectedPoint.set(p.getX(i), p.getY(i), p.getZ(i)).project(camera);
        points.push(`${(projectedPoint.x + 1) * size.width / 2},${(1 - projectedPoint.y) * size.height / 2}`);
      }
      overlay.setAttribute("points", points.join(" "));
      overlay.setAttribute("stroke", `#${material.color.getHexString()}`);
    }
  }, -1);
  return <>
    <primitive object={line} visible={!foreground} />
    {foreground && <Html fullscreen zIndexRange={[22, 22]} style={{ pointerEvents: "none" }}>
      <svg className="scroll-lineage-overlay" width={size.width} height={size.height} aria-hidden="true" style={{ display: "block", overflow: "hidden", pointerEvents: "none" }}>
        <polyline ref={foregroundPath} data-lineage-edge={edge.id} fill="none" stroke="#8b2626" strokeWidth="1.2" strokeDasharray={edge.disputed ? "5 5" : undefined} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Html>}
  </>;
}

function SpatialPerson({
  readable = false,
  cloudContext = false,
  allowCollapse = true,
  compact = false,
  lineage = false, compared = false, shared = false,
  node,
  scale,
  onSelect,
  onBranch,
  onFocus,
  hover,
}: {
  node: AtlasNode;
  readable?: boolean;
  cloudContext?: boolean;
  allowCollapse?: boolean;
  compact?: boolean;
  lineage?: boolean; compared?: boolean; shared?: boolean;
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
      className={`spatial-person ${readable ? 'is-readable' : ''} ${cloudContext ? 'is-cloud-context' : ''} ${lineage ? "is-lineage" : ""} ${compared ? "is-compared" : ""} ${shared ? "is-shared" : ""} ${node.deckPage !== undefined ? `generation-person ${compact ? "is-compact" : ""}` : ""} ${node.focusRole ? `depth-${node.focusRole}` : ""} ${node.selected ? "is-selected" : ""} ${node.dimmed ? "is-dimmed" : ""}`}
      style={{ transform: `scale(${scale})`, width: cloudContext ? [...p.name].length * 24 + 24 : node.width }}
    >
      <button
        data-atlas-control="person"
        data-person-id={p.id}
        className="spatial-person-name"
        style={node.deckPage !== undefined ? { height: cloudContext ? 44 : nameSlipHeight(p.name) } : undefined}
        aria-label={label}
        aria-pressed={node.selected}
        title={`${p.name}。来源：${sources}`}
        onPointerEnter={() => hover(p.id)}
        onPointerLeave={() => hover(null)}
        onFocus={(e) => {
          if (!readable && e.currentTarget.matches(":focus-visible")) onFocus(node);
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
            {node.focusRole === "mentor"
              ? "师父 · "
              : node.focusRole === "disciple"
                ? "徒弟 · "
                : ""}
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
      {allowCollapse && node.childCount > 0 && scale >= 0.65 && (
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
