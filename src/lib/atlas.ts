import { lineageFocus } from "./lineage-focus";
import type { Edge, Person } from "../types";

export interface AtlasViewport {
  width: number;
  height: number;
}
export interface AtlasCamera {
  x: number;
  y: number;
  scale: number;
}

// The full catalog needs roughly 10% scale on a 320px phone, with room to
// zoom out further after fitting. Keep Fit and manual zoom on the same range.
export const MIN_ATLAS_SCALE = 0.02;
export const MAX_ATLAS_SCALE = 2.4;
export const clampAtlasScale = (scale: number) =>
  Math.min(MAX_ATLAS_SCALE, Math.max(MIN_ATLAS_SCALE, scale));

export function fitAtlasCamera(
  viewport: AtlasViewport,
  bounds: AtlasLayout["bounds"],
): AtlasCamera {
  const scale = clampAtlasScale(
    Math.min(
      (viewport.width - 80) / bounds.width,
      (viewport.height - 100) / bounds.height,
      1,
    ),
  );
  return {
    scale,
    x: viewport.width / 2 - (bounds.x + bounds.width / 2) * scale,
    y: viewport.height / 2 - (bounds.y + bounds.height / 2) * scale,
  };
}

export function measureAtlasViewport(
  previous: AtlasViewport,
  measured: AtlasViewport,
): AtlasViewport {
  // display:none reports zero bounds; it is not a smaller usable canvas.
  if (
    measured.width <= 0 ||
    measured.height <= 0 ||
    !Number.isFinite(measured.width) ||
    !Number.isFinite(measured.height)
  )
    return previous;
  const next = {
    width: Math.max(280, measured.width),
    height: Math.max(500, measured.height),
  };
  return next.width === previous.width && next.height === previous.height
    ? previous
    : next;
}

export function focusAtlasCamera(
  viewport: AtlasViewport,
  node: Pick<AtlasNode, "x" | "y">,
): AtlasCamera {
  if (viewport.width >= 760) return { x: 0, y: 0, scale: 1 };
  // The mobile legend occupies the lower stage; center the active lineage in
  // the remaining reading area while retaining full-size names.
  const focusY = Math.min(270, Math.max(210, viewport.height * 0.45));
  return { x: viewport.width * 0.45 - node.x, y: focusY - node.y, scale: 1 };
}

export interface AtlasOptions {
  people: Person[];
  edges: Edge[];
  selectedId: string;
  mode: "scroll" | "tree";
  query?: string;
  generation?: string;
  expandedIds?: Set<string>;
  collapsedIds?: Set<string>;
  showAll?: boolean;
  viewportWidth?: number;
}

export interface AtlasNode {
  focusRole?: "current" | "mentor" | "disciple" | "ancestor" | "background";
  focusDepth?: number;
  deckPage?: number;
  deckOrdinal?: number;
  deckColumn?: number;
  person: Person;
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
  vertical: boolean;
  caption: string;
  dimmed: boolean;
  childCount: number;
  hiddenChildren: number;
}

export interface AtlasLayout {
  fixed?: boolean;
  nodes: AtlasNode[];
  edges: Array<Edge & { highlighted: boolean }>;
  columns: Array<{ index: number; label: string; x: number }>;
  bounds: { x: number; y: number; width: number; height: number };
  hasFilter: boolean;
  matchCount: number;
}

export function buildAtlas(options: AtlasOptions): AtlasLayout {
  const {
    people,
    selectedId,
    mode,
    expandedIds = new Set<string>(),
    collapsedIds = new Set<string>(),
    showAll = false,
  } = options;
  const byId = new Map(people.map((person) => [person.id, person]));
  const selected = byId.get(selectedId) ?? people[0];
  const query = options.query?.trim().toLocaleLowerCase() ?? "";
  const generation =
    options.generation &&
    options.generation !== "all" &&
    options.generation !== "全部"
      ? options.generation
      : "";
  const hasFilter = Boolean(query || generation);
  const matches = new Set(
    people
      .filter((person) => {
        const names = [
          person.id,
          person.name,
          person.nameHant,
          ...(person.aliases ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase();
        return (
          (!query || names.includes(query)) &&
          (!generation || person.generation === generation)
        );
      })
      .map((person) => person.id),
  );
  if (!selected)
    return {
      nodes: [],
      edges: [],
      columns: [],
      bounds: { x: 0, y: 0, width: 1120, height: 600 },
      hasFilter,
      matchCount: 0,
    };

  const edgeIds = new Set<string>();
  const validEdges = options.edges.filter((edge) => {
    if (!byId.has(edge.from) || !byId.has(edge.to) || edgeIds.has(edge.id))
      return false;
    edgeIds.add(edge.id);
    return true;
  });
  const children = new Map<string, Set<string>>();
  const parents = new Map<string, Set<string>>();
  for (const edge of validEdges) {
    if (!children.has(edge.from)) children.set(edge.from, new Set());
    if (!parents.has(edge.to)) parents.set(edge.to, new Set());
    children.get(edge.from)!.add(edge.to);
    parents.get(edge.to)!.add(edge.from);
  }

  // Traversal preserves every recorded parent, including alternative lineages.
  // A visited set makes this safe for accidental cycles in an imported catalog.
  const ancestors = (seeds: Iterable<string>) => {
    const found = new Set<string>();
    const queue = [...seeds];
    for (let index = 0; index < queue.length; index += 1) {
      const id = queue[index];
      if (found.has(id) || !byId.has(id)) continue;
      found.add(id);
      queue.push(...(parents.get(id) ?? []));
    }
    return found;
  };
  const context = ancestors([selected.id]);
  const visible = new Set(context);
  const featured =
    selected.id === "hou-baolin"
      ? new Set(["jiang-kun", "feng-gong", "zhao-yan"])
      : new Set<string>();

  if (showAll) {
    const roots = people
      .filter((person) => !parents.has(person.id))
      .map((person) => person.id);
    const covered = new Set<string>();
    const cover = (id: string) => {
      const queue = [id];
      for (let index = 0; index < queue.length; index += 1) {
        const next = queue[index];
        if (covered.has(next)) continue;
        covered.add(next);
        queue.push(...(children.get(next) ?? []));
      }
    };
    roots.forEach(cover);
    // Components made entirely of cycles also receive one traversal root.
    for (const person of people)
      if (!covered.has(person.id)) {
        roots.push(person.id);
        cover(person.id);
      }
    const queue = [...roots, ...context];
    const visited = new Set<string>();
    for (let index = 0; index < queue.length; index += 1) {
      const id = queue[index];
      if (visited.has(id)) continue;
      visited.add(id);
      visible.add(id);
      if (!collapsedIds.has(id)) queue.push(...(children.get(id) ?? []));
    }
  } else {
    const queue = [...context];
    const visited = new Set<string>();
    for (let index = 0; index < queue.length; index += 1) {
      const id = queue[index];
      if (visited.has(id)) continue;
      visited.add(id);
      if (collapsedIds.has(id)) continue;
      const childIds = [...(children.get(id) ?? [])];
      const introductoryChildren =
        id === "hou-baolin"
          ? new Set(["ma-ji", "shi-shengjie"])
          : id === "ma-ji"
            ? new Set(["jiang-kun", "feng-gong", "zhao-yan"])
            : new Set(childIds.slice(0, 3));
      for (const child of childIds) {
        if (
          expandedIds.has(id) ||
          (id === selected.id && introductoryChildren.has(child)) ||
          (id === "ma-ji" && featured.has(child))
        ) {
          visible.add(child);
          queue.push(child);
        }
      }
    }
  }
  if (hasFilter) for (const id of ancestors(matches)) visible.add(id);

  const featuredPrimary = ["ma-ji", "jiang-kun", "feng-gong", "zhao-yan", "shi-shengjie"];
  const primaryRank = (id: string) => {
    const index = featuredPrimary.indexOf(id);
    return index < 0 ? featuredPrimary.length : index;
  };
  const primaryMentor = validEdges
    .filter((edge) => edge.to === selected.id && !edge.disputed && visible.has(edge.from))
    .filter((edge) => (byId.get(edge.from)?.generationIndex ?? Infinity) < selected.generationIndex)
    .sort((a, b) =>
      (byId.get(b.from)?.generationIndex ?? -Infinity) -
        (byId.get(a.from)?.generationIndex ?? -Infinity) ||
      primaryRank(a.from) - primaryRank(b.from) ||
      a.from.localeCompare(b.from, "zh-Hans"),
    )[0]?.from;
  const primaryChild = validEdges
    .filter((edge) => edge.from === selected.id && !edge.disputed && visible.has(edge.to))
    .filter((edge) => (byId.get(edge.to)?.generationIndex ?? -Infinity) > selected.generationIndex)
    .sort((a, b) =>
      primaryRank(a.to) - primaryRank(b.to) || a.to.localeCompare(b.to, "zh-Hans"),
    )[0]?.to;
  const verticalIds = new Set([
    selected.id,
    ...(mode === "tree"
      ? [primaryMentor, primaryChild].filter((id): id is string => Boolean(id))
      : []),
  ]);
  const priorityIds = [
    selected.id,
    primaryMentor,
    primaryChild,
    "ma-ji",
    "jiang-kun",
    "feng-gong",
    "zhao-yan",
    "shi-shengjie",
  ];
  const priority = (id: string) => {
    const index = priorityIds.indexOf(id);
    return index < 0 ? 100 : index;
  };
  const cohorts = new Map<number, Person[]>();
  for (const person of people) {
    if (!visible.has(person.id)) continue;
    if (!cohorts.has(person.generationIndex))
      cohorts.set(person.generationIndex, []);
    cohorts.get(person.generationIndex)!.push(person);
  }
  const nodes: AtlasNode[] = [];
  const columns: AtlasLayout["columns"] = [];
  // Keep four introductory generations visible at full text size on desktop.
  // Narrow screens retain a spacious logical canvas and pan through it.
  const logicalWidth = Math.max(860, options.viewportWidth ?? 1120);
  const columnSpacing = Math.max(190, Math.min(260, (logicalWidth - 255) / 3));
  const selectedX = Math.min(470, logicalWidth * 0.4);
  const desktopTree = mode === "tree" && (options.viewportWidth ?? 1120) >= 760;
  for (const [index, cohort] of [...cohorts].sort(([a], [b]) => a - b)) {
    cohort.sort(
      (a, b) =>
        priority(a.id) - priority(b.id) ||
        a.name.localeCompare(b.name, "zh-Hans"),
    );
    const x = selectedX + (index - selected.generationIndex) * columnSpacing;
    const hasVertical = cohort.some((person) => verticalIds.has(person.id));
    const baseY =
      mode === "tree" && hasVertical
        ? desktopTree || cohort.some((person) => person.id === selected.id)
          ? 350
          : 330
        : index < selected.generationIndex
          ? 320
          : index === selected.generationIndex
            ? 350
            : 380;
    const centerY =
      baseY -
      (desktopTree ? 45 : 0) +
      (mode === "scroll"
        ? Math.sin((index - selected.generationIndex) * 1.5) * 8
        : 0);
    columns.push({
      index,
      label:
        cohort.find((person) => person.generation)?.generation ?? "世代待考",
      x,
    });
    const compactRows = cohort.length <= 3 && !hasVertical;
    let top = centerY;
    let bottom = centerY;
    cohort.forEach((person, rank) => {
      const isSelected = person.id === selected.id;
      const vertical = verticalIds.has(person.id);
      // The selected person's layout box also reserves space for its marker
      // and caption, so neighboring people cannot overlap those annotations.
      const height = vertical
        ? Math.max(112, person.name.length * 32 + 16) + (isSelected ? 100 : 36)
        : 48;
      const width = vertical ? 46 : Math.max(110, person.name.length * 22 + 30);
      const gap = hasVertical ? 24 : cohort.length <= 4 ? 48 : 24;
      let y = centerY;
      if (compactRows) {
        y = centerY + (rank - (cohort.length - 1) / 2) * 96;
      } else if (rank === 0) {
        top -= height / 2;
        bottom += height / 2;
      } else if (rank % 2 === 1) {
        y = bottom + gap + height / 2;
        bottom = y + height / 2;
      } else {
        y = top - gap - height / 2;
        top = y - height / 2;
      }
      const childIds = [...(children.get(person.id) ?? [])];
      const lifeDates =
        person.birthYear && person.deathYear
          ? `${person.birthYear}—${person.deathYear}`
          : person.birthYear
            ? `生于 ${person.birthYear}`
            : person.deathYear
              ? `卒于 ${person.deathYear}`
              : "生卒年待考";
      const caption =
        isSelected && mode === "tree"
          ? lifeDates
          : `${person.generation ? `${person.generation}字辈` : "字辈待考"}${isSelected ? " · 当前人物" : ""}`;
      nodes.push({
        person,
        x,
        y,
        width,
        height,
        selected: isSelected,
        vertical,
        caption,
        dimmed: hasFilter && !matches.has(person.id),
        childCount: childIds.length,
        hiddenChildren: childIds.filter((id) => !visible.has(id)).length,
      });
    });
  }
  const minX = Math.min(...nodes.map((node) => node.x - node.width / 2)) - 70;
  const maxX = Math.max(...nodes.map((node) => node.x + node.width / 2)) + 90;
  const minY = Math.min(...nodes.map((node) => node.y - node.height / 2)) - 80;
  const maxY = Math.max(...nodes.map((node) => node.y + node.height / 2)) + 80;
  const focus = lineageFocus(selected.id, validEdges);
  return {
    nodes,
    edges: validEdges
      .filter((edge) => visible.has(edge.from) && visible.has(edge.to))
      .map((edge) => ({
        ...edge,
        highlighted: focus.links.has(edge.id),
      })),
    columns,
    bounds: {
      x: minX,
      y: minY,
      width: Math.max(300, maxX - minX),
      height: Math.max(300, maxY - minY),
    },
    hasFilter,
    matchCount: matches.size,
  };
}
