import { buildAtlas } from "./atlas";
import type {
  AtlasCamera,
  AtlasLayout,
  AtlasNode,
  AtlasOptions,
  AtlasViewport,
} from "./atlas";

/** A finite world: selection/filter/viewport never changes a person's slot. */
export function buildFixedScroll(options: AtlasOptions): AtlasLayout {
  const graph = buildAtlas({
    ...options,
    mode: "scroll",
    showAll: true,
    collapsedIds: new Set(),
    viewportWidth: 1120,
  });
  const ordered = [...graph.nodes].sort(
    (a, b) =>
      a.person.generationIndex - b.person.generationIndex ||
      a.person.name.localeCompare(b.person.name, "zh-Hans"),
  );
  const mentors = new Set(
    graph.edges.filter((e) => e.to === options.selectedId).map((e) => e.from),
  );
  const disciples = new Set(
    graph.edges.filter((e) => e.from === options.selectedId).map((e) => e.to),
  );
  const ancestors = new Set<string>();
  const queue = [...mentors];
  while (queue.length) {
    const id = queue.pop()!;
    if (ancestors.has(id)) continue;
    ancestors.add(id);
    queue.push(...graph.edges.filter((e) => e.to === id).map((e) => e.from));
  }
  let column = 0,
    rank = 0,
    generation = ordered[0]?.person.generationIndex;
  const columns: AtlasLayout["columns"] = [];
  const nodes = ordered.map((node) => {
    if (node.person.generationIndex !== generation) {
      column += 1;
      rank = 0;
      generation = node.person.generationIndex;
    }
    if (rank === 0)
      columns.push({
        index: generation!,
        label: ["第一代", "第二代", "第三代", "德", "寿", "宝", "文", "明"][generation! - 1] ?? "世代待考",
        x: 220 + column * 460,
      });
    const x = 220 + column * 460;
    const y = 290 + Math.floor(rank / 3) * 46;
    const deckOrdinal = rank;
    const deckPage = 0;
    const deckColumn = rank % 3;
    rank++;
    const focusRole: NonNullable<AtlasNode["focusRole"]> = node.selected
      ? "current"
      : disciples.has(node.person.id)
        ? "disciple"
        : mentors.has(node.person.id)
          ? "mentor"
          : ancestors.has(node.person.id)
            ? "ancestor"
            : "background";
    const focusDepth = {
      current: 0.14,
      disciple: 0.18,
      mentor: 0.1,
      ancestor: 0.02,
      background: -0.35,
    }[focusRole];
    return {
      ...node,
      x,
      y,
      width: 100,
      height: 160,
      hiddenChildren: 0,
      focusRole,
      focusDepth,
      deckPage,
      deckOrdinal,
      deckColumn,
    };
  });
  return {
    ...graph,
    fixed: true,
    edges: graph.edges,
    nodes,
    columns,
    bounds: {
      x: nodes[0].x - 100,
      y: 130,
      width: nodes[nodes.length - 1].x - nodes[0].x + 200,
      height: 540,
    },
  };
}

/** Stop at a useful overview, instead of shrinking the scroll to a speck. */
export function minimumScrollScale(viewport: AtlasViewport, graph: AtlasLayout) {
  return Math.max(.12, Math.min(.45, viewport.width * .88 / Math.max(1, graph.bounds.width)));
}

export function boundScrollCamera(
  camera: AtlasCamera,
  viewport: AtlasViewport,
  graph: AtlasLayout,
): AtlasCamera {
  const scale = Math.max(minimumScrollScale(viewport, graph), camera.scale);
  const focus = (viewport.width * .5 - camera.x) / camera.scale;
  camera = { ...camera, scale, x: viewport.width * .5 - focus * scale };
  const first = Math.min(...graph.nodes.map((n) => n.x));
  const last = Math.max(...graph.nodes.map((n) => n.x));
  const anchor = viewport.width * 0.5;
  return {
    ...camera,
    x: Math.max(
      anchor - last * camera.scale,
      Math.min(anchor - first * camera.scale, camera.x),
    ),
    y: viewport.height * 0.45 - 400 * camera.scale,
  };
}

export function focusScrollCamera(
  viewport: AtlasViewport,
  graph: AtlasLayout,
  id: string,
  scale = 1,
): AtlasCamera {
  const node = graph.nodes.find((n) => n.person.id === id) ?? graph.nodes[0];
  return boundScrollCamera(
    { x: viewport.width * 0.5 - node.x * scale, y: 0, scale },
    viewport,
    graph,
  );
}
