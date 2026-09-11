import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { ArrowsOut, Crosshair, Minus, Plus } from "@phosphor-icons/react";
import { edges, people, peopleById, sourcesById } from "../lib/catalog";
import {
  buildAtlas,
  clampAtlasScale,
  fitAtlasCamera,
  focusAtlasCamera,
  MAX_ATLAS_SCALE,
  measureAtlasViewport,
  MIN_ATLAS_SCALE,
} from "../lib/atlas";
import type { AtlasCamera, AtlasNode } from "../lib/atlas";
import "./atlas-graph.css";

const SpatialTree = lazy(() => import("./SpatialTree"));
const ScrollScene = lazy(() => import("./ScrollScene"));

interface AtlasGraphProps {
  active?: boolean;
  selectedId: string;
  mode: "scroll" | "tree";
  query: string;
  generation: string;
  onSelect: (id: string) => void;
}

type Camera = AtlasCamera;
type AtlasMode = AtlasGraphProps["mode"];
const rememberedCameras: Partial<Record<AtlasMode, Camera>> = {};
const initialCamera: Camera = { x: 0, y: 0, scale: 1 };

function sourceLabel(ids: string[]) {
  return ids.length
    ? ids.map((id) => sourcesById[id]?.title ?? id).join("；")
    : "来源待补";
}

function edgePath(from: AtlasNode, to: AtlasNode) {
  const forward = to.x >= from.x;
  const startX = from.x + (from.width / 2) * (forward ? 1 : -1);
  const endX = to.x - (to.width / 2) * (forward ? 1 : -1);
  if (from.x === to.x) {
    const bendX = from.x + Math.max(from.width, to.width) / 2 + 48;
    return `M ${startX} ${from.y} C ${bendX} ${from.y}, ${bendX} ${to.y}, ${endX} ${to.y}`;
  }
  const middle = (startX + endX) / 2;
  return `M ${startX} ${from.y} C ${middle} ${from.y}, ${middle} ${to.y}, ${endX} ${to.y}`;
}

export function AtlasGraph({
  selectedId,
  active = true,
  mode,
  query,
  generation,
  onSelect,
}: AtlasGraphProps) {
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 1120, height: 600 });
  const [cameras, setCameras] = useState<Record<AtlasMode, Camera>>(() => ({
    scroll: rememberedCameras.scroll ?? initialCamera,
    tree: rememberedCameras.tree ?? initialCamera,
  }));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [dragging, setDragging] = useState(false);
  const initializedModes = useRef(
    new Set<AtlasMode>(Object.keys(rememberedCameras) as AtlasMode[]),
  );
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    camera: Camera;
  } | null>(null);
  const previousSelected = useRef(selectedId);
  const graph = useMemo(
    () =>
      buildAtlas({
        people,
        edges,
        selectedId,
        mode,
        query,
        generation,
        expandedIds,
        collapsedIds,
        showAll,
        viewportWidth: size.width,
      }),
    [
      selectedId,
      mode,
      query,
      generation,
      expandedIds,
      collapsedIds,
      showAll,
      size.width,
    ],
  );
  const lookup = useMemo(
    () => new Map(graph.nodes.map((node) => [node.person.id, node])),
    [graph.nodes],
  );
  const camera = cameras[mode];
  const currentPerson = peopleById[selectedId] ?? people[0];

  const updateCamera = useCallback(
    (next: Camera | ((previous: Camera) => Camera)) => {
      initializedModes.current.add(mode);
      setCameras((previous) => {
        const value = typeof next === "function" ? next(previous[mode]) : next;
        rememberedCameras[mode] = value;
        return { ...previous, [mode]: value };
      });
    },
    [mode],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      setSize((previous) => measureAtlasViewport(previous, rect));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (initializedModes.current.has(mode)) return;
    const rect = hostRef.current?.getBoundingClientRect();
    if (
      !rect ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      Math.abs(rect.width - size.width) > 1
    )
      return;
    const node = lookup.get(selectedId);
    if (node) updateCamera(focusAtlasCamera(size, node));
  }, [mode, size, updateCamera, lookup, selectedId]);

  const centerSelected = useCallback(() => {
    const node = lookup.get(selectedId);
    if (!node) return;
    updateCamera(focusAtlasCamera(size, node));
  }, [lookup, selectedId, size, updateCamera]);

  useEffect(() => {
    if (previousSelected.current === selectedId) return;
    previousSelected.current = selectedId;
    setCollapsedIds(new Set());
    setExpandedIds(new Set());
    centerSelected();
  }, [selectedId, centerSelected]);

  const zoom = useCallback(
    (factor: number, point?: { x: number; y: number }) => {
      updateCamera((previous) => {
        const scale = clampAtlasScale(previous.scale * factor);
        const anchor = point ?? { x: size.width / 2, y: size.height / 2 };
        const ratio = scale / previous.scale;
        return {
          scale,
          x: anchor.x - (anchor.x - previous.x) * ratio,
          y: anchor.y - (anchor.y - previous.y) * ratio,
        };
      });
    },
    [size, updateCamera],
  );

  useEffect(() => {
    const svg = hostRef.current;
    if (!svg) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoom(Math.exp(-event.deltaY * 0.005), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [zoom]);

  const fitGraph = () => {
    updateCamera(fitAtlasCamera(size, graph.bounds));
  };

  const toggleBranch = (node: AtlasNode) => {
    const opening = node.hiddenChildren > 0 || collapsedIds.has(node.person.id);
    setCollapsedIds((previous) => {
      const next = new Set(previous);
      if (opening) next.delete(node.person.id);
      else next.add(node.person.id);
      return next;
    });
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (opening) next.add(node.person.id);
      else next.delete(node.person.id);
      return next;
    });
  };

  const startPan = (event: PointerEvent<SVGSVGElement | HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      (event.target as Element).closest("[data-atlas-control]")
    )
      return;
    drag.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      camera,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const movePan = (event: PointerEvent<SVGSVGElement | HTMLDivElement>) => {
    const start = drag.current;
    if (!start || event.pointerId !== start.pointer) return;
    updateCamera({
      ...start.camera,
      x: start.camera.x + event.clientX - start.x,
      y: start.camera.y + event.clientY - start.y,
    });
  };
  const endPan = (event: PointerEvent<SVGSVGElement | HTMLDivElement>) => {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onGraphKey = (event: KeyboardEvent<SVGSVGElement | HTMLDivElement>) => {
    const shifts: Record<string, [number, number]> = {
      ArrowLeft: [70, 0],
      ArrowRight: [-70, 0],
      ArrowUp: [0, 70],
      ArrowDown: [0, -70],
    };
    if (shifts[event.key]) {
      event.preventDefault();
      const [x, y] = shifts[event.key];
      updateCamera((previous) => ({
        ...previous,
        x: previous.x + x,
        y: previous.y + y,
      }));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoom(1.2);
    } else if (event.key === "-") {
      event.preventDefault();
      zoom(1 / 1.2);
    } else if (event.key === "0") {
      event.preventDefault();
      centerSelected();
    }
  };
  const activate = (event: KeyboardEvent<SVGGElement>, action: () => void) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    action();
  };
  const revealFocusedNode = (node: AtlasNode) => {
    if (camera.scale < 0.75) {
      updateCamera(focusAtlasCamera(size, node));
      return;
    }
    const screenX = node.x * camera.scale + camera.x;
    const screenY = node.y * camera.scale + camera.y;
    if (
      screenX >= 75 &&
      screenX <= size.width - 75 &&
      screenY >= 100 &&
      screenY <= size.height - 120
    )
      return;
    updateCamera((previous) => ({
      ...previous,
      x: size.width / 2 - node.x * previous.scale,
      y: size.height / 2 - node.y * previous.scale,
    }));
  };

  const [spatialTree, setSpatialTree] = useState(true);
  return (
    <div
      ref={hostRef}
      className={`atlas-graph atlas-graph--${mode}${dragging ? " atlas-graph--dragging" : ""}`}
    >
      <div className="atlas-topline">
        <span className="atlas-direction">由师而徒，自左向右</span>
        {mode === "tree" && (
          <button
            className="atlas-scope"
            aria-pressed={spatialTree}
            onClick={() => setSpatialTree(!spatialTree)}
          >
            {spatialTree ? "切换平面谱系" : "切换立体谱系"}
          </button>
        )}
        <button
          type="button"
          className="atlas-scope"
          aria-pressed={showAll}
          onClick={() => {
            setShowAll(!showAll);
            setCollapsedIds(new Set());
            setExpandedIds(new Set());
          }}
        >
          {showAll ? "收回当前一脉" : `展开全谱 · ${people.length} 人`}
        </button>
      </div>
      {mode === "tree" && spatialTree ? (
        <Suspense fallback={<div className="scroll-loading">山水正在舒展</div>}>
          <SpatialTree
            graph={graph}
            view={camera}
            viewport={size}
            selectedId={selectedId}
            dragging={dragging}
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={endPan}
            onKeyDown={onGraphKey}
            active={active}
            onSelect={onSelect}
            onBranch={(id) => {
              const node = graph.nodes.find((n) => n.person.id === id);
              if (node) toggleBranch(node);
            }}
          />
        </Suspense>
      ) : mode === "scroll" && !webglUnavailable ? (
        <Suspense fallback={<div className="scroll-loading">山水正在舒展</div>}>
          <ScrollScene
            graph={graph}
            view={camera}
            viewport={size}
            active={active}
            onSelect={onSelect}
            onBranch={toggleBranch}
            onFocus={revealFocusedNode}
            onFailure={() => setWebglUnavailable(true)}
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={endPan}
            onKeyDown={onGraphKey}
          />
        </Suspense>
      ) : (
        <svg
          ref={svgRef}
          className="atlas-canvas"
          viewBox={`0 0 ${size.width} ${size.height}`}
          role="group"
          aria-label={`${currentPerson.name}的${mode === "tree" ? "世代谱系" : "山水长卷"}，师承方向从左至右`}
          aria-describedby="atlas-instructions"
          tabIndex={0}
          onKeyDown={onGraphKey}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
        >
          <title>相声历史师承图</title>
          <desc>
            人物按真实字辈分列。实线为已收录师承，虚线为存在不同说法的师承。历史师承不表示当前组织归属。人物可用
            Tab 键选中，回车查看。
          </desc>
          <defs>
            <marker
              id="atlas-arrow"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path
                d="M 1 1 L 5 3 L 1 5"
                fill="none"
                stroke="context-stroke"
                strokeWidth="1"
              />
            </marker>
          </defs>
          <g
            transform={`translate(${camera.x} ${camera.y}) scale(${camera.scale})`}
          >
            {mode === "tree" &&
              graph.columns.map((column) => (
                <g
                  key={column.index}
                  className="atlas-column"
                  aria-hidden="true"
                >
                  <line
                    x1={column.x}
                    x2={column.x}
                    y1={graph.bounds.y}
                    y2={graph.bounds.y + graph.bounds.height}
                  />
                  <text
                    x={column.x}
                    y={(85 - camera.y) / camera.scale}
                    textAnchor="middle"
                  >
                    {column.label === "世代待考"
                      ? column.label
                      : `${column.label}字辈`}
                  </text>
                </g>
              ))}
            <g className="atlas-relations">
              {graph.edges.map((edge) => {
                const from = lookup.get(edge.from)!;
                const to = lookup.get(edge.to)!;
                return (
                  <path
                    key={edge.id}
                    d={edgePath(from, to)}
                    markerEnd="url(#atlas-arrow)"
                    className={`atlas-edge${edge.highlighted ? " atlas-edge--active" : ""}${edge.disputed ? " atlas-edge--disputed" : ""}${from.dimmed || to.dimmed ? " atlas-edge--dimmed" : ""}`}
                  >
                    <title>{`${from.person.name} → ${to.person.name}；历史师承${edge.disputed ? "；存在不同说法" : ""}${edge.note ? `；${edge.note}` : ""}。来源：${sourceLabel(edge.sources)}`}</title>
                  </path>
                );
              })}
            </g>
            {graph.nodes.map((node) => {
              const { person } = node;
              const opening =
                node.hiddenChildren > 0 || collapsedIds.has(person.id);
              const branchX = node.width / 2 + 20;
              const slipHeight = node.vertical
                ? node.height - (node.selected ? 100 : 36)
                : node.height;
              return (
                <g
                  key={person.id}
                  transform={`translate(${node.x} ${node.y})`}
                  className={`atlas-person${node.vertical ? " atlas-person--vertical" : ""}${node.selected ? " atlas-person--selected" : ""}${node.dimmed ? " atlas-person--dimmed" : ""}`}
                >
                  <g
                    className="atlas-person-target"
                    data-atlas-control="person"
                    role="button"
                    tabIndex={0}
                    aria-pressed={node.selected}
                    aria-label={`${person.name}，${person.generation ? `${person.generation}字辈` : "字辈待考"}${person.disputed ? "，资料存在不同说法" : ""}，查看人物`}
                    onFocus={() => revealFocusedNode(node)}
                    onClick={() => onSelect(person.id)}
                    onKeyDown={(event) =>
                      activate(event, () => onSelect(person.id))
                    }
                  >
                    <title>{`${person.name}${person.birthYear ? `（${person.birthYear}—${person.deathYear ?? ""}）` : ""}。来源：${sourceLabel(person.sources)}${person.disputed ? "。部分资料存在不同说法。" : ""}`}</title>
                    <rect
                      className="atlas-node-paper"
                      x={-node.width / 2}
                      y={-slipHeight / 2}
                      width={node.width}
                      height={slipHeight}
                      rx={node.selected ? 2 : 3}
                    />
                    {node.vertical ? (
                      <>
                        <text
                          className={`atlas-slip-name${node.selected ? " atlas-selected-name" : ""}`}
                          textAnchor="middle"
                        >
                          {[...person.name].map((character, index) => (
                            <tspan
                              key={index}
                              x="0"
                              y={
                                -(person.name.length - 1) * 16 + index * 32 + 10
                              }
                            >
                              {character}
                            </tspan>
                          ))}
                        </text>
                        <circle
                          className={`atlas-slip-dot${node.selected ? " atlas-selected-dot" : ""}`}
                          cy={slipHeight / 2 + (mode === "tree" ? 2 : 17)}
                          r="4"
                        />
                        {node.selected && (
                          <text
                            className={`atlas-selected-caption${mode === "tree" ? " atlas-selected-dates" : ""}`}
                            x="0"
                            y={slipHeight / 2 + (mode === "tree" ? 30 : 47)}
                            textAnchor="middle"
                          >
                            {node.caption}
                          </text>
                        )}
                      </>
                    ) : (
                      <>
                        <text
                          className="atlas-person-name"
                          y="-2"
                          dominantBaseline="middle"
                          textAnchor="middle"
                        >
                          {person.name}
                        </text>
                        <text
                          className="atlas-person-meta"
                          y="19"
                          textAnchor="middle"
                        >
                          {person.generation
                            ? `${person.generation}字辈`
                            : "字辈待考"}
                          {person.disputed ? " · 存疑" : ""}
                        </text>
                      </>
                    )}
                  </g>
                  {node.childCount > 0 && (
                    <g
                      className="atlas-branch"
                      transform={`translate(${branchX} 0)`}
                      data-atlas-control="branch"
                      role="button"
                      tabIndex={0}
                      aria-label={`${opening ? "展开" : "收起"}${person.name}的弟子分支${opening && node.hiddenChildren ? `，另有 ${node.hiddenChildren} 人` : ""}`}
                      aria-expanded={!opening}
                      onFocus={() => revealFocusedNode(node)}
                      onClick={() => toggleBranch(node)}
                      onKeyDown={(event) =>
                        activate(event, () => toggleBranch(node))
                      }
                    >
                      <title>
                        {opening
                          ? `展开${person.name}门下${node.hiddenChildren ? `另外 ${node.hiddenChildren} 人` : ""}`
                          : `收起${person.name}门下分支`}
                      </title>
                      <rect
                        className="atlas-branch-hit"
                        x="-18"
                        y="-22"
                        width="44"
                        height="44"
                        rx="8"
                      />
                      <circle r="11" />
                      <path
                        d={opening ? "M -4 0 H 4 M 0 -4 V 4" : "M -4 0 H 4"}
                      />
                      {opening && node.hiddenChildren > 0 && (
                        <text x="18" y="4">
                          {node.hiddenChildren}
                        </text>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}
      {webglUnavailable && mode === "scroll" && (
        <p className="scroll-fallback-note" role="status">
          当前设备未能启用立体画卷，已保留平面谱系阅读。
        </p>
      )}
      <div className="atlas-bottomline">
        <div className="atlas-notes">
          <div className="atlas-legend">
            <span className="atlas-legend-line" />
            师承
            <span className="atlas-legend-line atlas-legend-line--disputed" />
            不同说法
          </div>
          <p id="atlas-instructions">
            {mode === "scroll" && !webglUnavailable
              ? "移鼠展卷 · 拖动游谱 · 点选人物"
              : "拖动移卷 · 方向键平移 · 点击人物读笺"}
          </p>
          <p className="atlas-result" role="status">
            {graph.hasFilter
              ? `${graph.matchCount} 人符合筛选 · 浅墨保留师承上下文`
              : `已展 ${graph.nodes.length} 人 · 历史师承不等同组织归属`}
          </p>
        </div>
        <div className="atlas-camera" role="group" aria-label="图谱视角">
          <button
            type="button"
            title="缩小"
            aria-label="缩小图谱"
            onClick={() => zoom(1 / 1.2)}
            disabled={camera.scale <= MIN_ATLAS_SCALE}
          >
            <Minus size={18} />
          </button>
          <output aria-label="缩放比例">
            {Math.round(camera.scale * 100)}%
          </output>
          <button
            type="button"
            title="放大"
            aria-label="放大图谱"
            onClick={() => zoom(1.2)}
            disabled={camera.scale >= MAX_ATLAS_SCALE}
          >
            <Plus size={18} />
          </button>
          <span className="atlas-camera-divider" />
          <button
            type="button"
            title="查看已展全貌"
            aria-label="适应已展开图谱"
            onClick={fitGraph}
          >
            <ArrowsOut size={18} />
          </button>
          <button
            type="button"
            title="返回当前人物，重置缩放"
            aria-label="返回当前人物并重置缩放"
            onClick={centerSelected}
          >
            <Crosshair size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
