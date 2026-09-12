import { describe, expect, it } from "vitest";
import { loadEdgesFromDisk, loadPeopleFromDisk } from "./loadCatalog.node";
import {
  buildAtlas,
  clampAtlasScale,
  fitAtlasCamera,
  focusAtlasCamera,
  measureAtlasViewport,
} from "./atlas";

const people = loadPeopleFromDisk();
const edges = loadEdgesFromDisk();
const base = { people, edges, selectedId: "hou-baolin", mode: "tree" as const };

describe("atlas genealogy", () => {
  it.each(["tree", "scroll"] as const)(
    "fits every catalog label within a 320px phone's %s stage",
    (mode) => {
      // The page reserves 4% on each side, leaving 294.4px for the graph.
      const viewport = { width: 294.4, height: 580 };
      const graph = buildAtlas({
        ...base,
        mode,
        showAll: true,
        viewportWidth: viewport.width,
      });
      const camera = fitAtlasCamera(viewport, graph.bounds);
      expect(clampAtlasScale(camera.scale / 1.2)).toBeLessThan(camera.scale);
      for (const node of graph.nodes) {
        const left = camera.x + (node.x - node.width / 2) * camera.scale;
        const right = camera.x + (node.x + node.width / 2) * camera.scale;
        const top = camera.y + (node.y - node.height / 2) * camera.scale;
        const bottom = camera.y + (node.y + node.height / 2) * camera.scale;
        expect(left, node.person.name).toBeGreaterThanOrEqual(40);
        expect(right, node.person.name).toBeLessThanOrEqual(viewport.width - 40);
        expect(top, node.person.name).toBeGreaterThanOrEqual(50);
        expect(bottom, node.person.name).toBeLessThanOrEqual(viewport.height - 50);
      }
    },
  );

  it("opens a compact main lineage and reports the remaining direct disciples", () => {
    const graph = buildAtlas(base);
    const ids = new Set(graph.nodes.map((node) => node.person.id));
    expect(ids.has("zhu-kuoquan")).toBe(true);
    expect(ids.has("shi-shengjie")).toBe(true);
    expect(ids.has("ding-guangquan")).toBe(false);
    expect(ids.has("jiang-kun")).toBe(true);
    expect(ids.has("feng-gong")).toBe(true);
    expect(ids.has("zhao-yan")).toBe(true);
    expect(
      graph.edges.some(
        (edge) => edge.from === "hou-baolin" && edge.to === "shi-shengjie",
      ),
    ).toBe(true);
    expect(
      graph.edges.some(
        (edge) => edge.from === "ma-ji" && edge.to === "shi-shengjie",
      ),
    ).toBe(false);
    expect(
      graph.nodes.find((node) => node.person.id === "hou-baolin")
        ?.hiddenChildren,
    ).toBeGreaterThan(0);
    expect(
      graph.nodes.find((node) => node.person.id === "ma-ji")?.hiddenChildren,
    ).toBeGreaterThan(0);
    const lit = new Set(graph.edges.filter(edge => edge.highlighted).map(edge => edge.id));
    expect(lit.has("zhu-kuoquan--hou-baolin")).toBe(true);
    expect(lit.has("hou-baolin--ma-ji")).toBe(true);
    expect(lit.has("hou-baolin--shi-shengjie")).toBe(true);
    expect(lit.has("ma-ji--jiang-kun")).toBe(true);
    expect(lit.size).toBeGreaterThan(2);
  });

  it("aligns actual cohorts and gives every person a non-overlapping label", () => {
    const graph = buildAtlas({ ...base, showAll: true });
    expect(graph.nodes).toHaveLength(people.length);
    const byId = new Map(graph.nodes.map((node) => [node.person.id, node]));
    expect(byId.get("wang-fengshan")!.x).toBe(byId.get("hou-baolin")!.x);
    expect(byId.get("shi-shengjie")!.x).toBe(byId.get("ma-ji")!.x);
    for (const column of graph.columns) {
      const cohort = graph.nodes
        .filter((node) => node.person.generationIndex === column.index)
        .sort((a, b) => a.y - b.y);
      for (let i = 1; i < cohort.length; i += 1) {
        expect(cohort[i].y - cohort[i - 1].y).toBeGreaterThanOrEqual(
          (cohort[i].height + cohort[i - 1].height) / 2 + 12,
        );
      }
    }
  });

  it("expands and collapses a branch without changing recorded mentor edges", () => {
    const expanded = buildAtlas({ ...base, expandedIds: new Set(["ma-ji"]) });
    expect(expanded.nodes.some((node) => node.person.id === "liu-wei")).toBe(
      true,
    );
    const collapsed = buildAtlas({ ...base, collapsedIds: new Set(["ma-ji"]) });
    expect(collapsed.nodes.some((node) => node.person.id === "jiang-kun")).toBe(
      false,
    );
    expect(collapsed.nodes.some((node) => node.person.id === "ma-ji")).toBe(
      true,
    );
    expect(
      collapsed.nodes.some((node) => node.person.id === "shi-shengjie"),
    ).toBe(true);
    const expandedHou = buildAtlas({
      ...base,
      expandedIds: new Set(["hou-baolin"]),
    });
    expect(
      expandedHou.nodes.find((node) => node.person.id === "hou-baolin")
        ?.hiddenChildren,
    ).toBe(0);
    expect(
      expandedHou.nodes.some((node) => node.person.id === "ding-guangquan"),
    ).toBe(true);
  });

  it("finds a person beyond the open branch and retains selected ancestors as dim context", () => {
    const graph = buildAtlas({ ...base, query: "郭德纲", generation: "明" });
    expect(
      graph.nodes.find((node) => node.person.id === "guo-degang")?.dimmed,
    ).toBe(false);
    expect(
      graph.nodes.find((node) => node.person.id === "zhu-kuoquan")?.dimmed,
    ).toBe(true);
    expect(
      graph.nodes.find((node) => node.person.id === "hou-baolin")?.selected,
    ).toBe(true);
    expect(graph.matchCount).toBe(1);
  });

  it("terminates on cycles and excludes dangling or duplicate relations", () => {
    const pair = people.filter((person) =>
      ["hou-baolin", "ma-ji"].includes(person.id),
    );
    const edge = edges.find(
      (item) => item.from === "hou-baolin" && item.to === "ma-ji",
    )!;
    const graph = buildAtlas({
      ...base,
      people: pair,
      edges: [
        edge,
        edge,
        { ...edge, id: "cycle", from: "ma-ji", to: "hou-baolin" },
        { ...edge, id: "dangling", to: "missing" },
      ],
      expandedIds: new Set(["hou-baolin", "ma-ji"]),
    });
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(2);
    expect(
      graph.nodes.every(
        (node) => Number.isFinite(node.x) && Number.isFinite(node.y),
      ),
    ).toBe(true);
  });

  it("preserves mentor direction and label separation in the scenic layout", () => {
    const graph = buildAtlas({ ...base, mode: "scroll", showAll: true });
    const byId = new Map(graph.nodes.map((node) => [node.person.id, node]));
    expect(byId.get("zhu-kuoquan")!.x).toBeLessThan(byId.get("hou-baolin")!.x);
    expect(byId.get("hou-baolin")!.x).toBeLessThan(byId.get("ma-ji")!.x);
    expect(byId.get("ma-ji")!.x).toBeLessThan(byId.get("jiang-kun")!.x);
    for (const column of graph.columns) {
      const cohort = graph.nodes
        .filter((node) => node.person.generationIndex === column.index)
        .sort((a, b) => a.y - b.y);
      for (let i = 1; i < cohort.length; i += 1)
        expect(cohort[i].y - cohort[i - 1].y).toBeGreaterThanOrEqual(
          (cohort[i].height + cohort[i - 1].height) / 2 + 12,
        );
    }
  });

  it("reserves room for the selected name slip and its caption among peers", () => {
    const graph = buildAtlas({ ...base, showAll: true });
    const hou = graph.nodes.find((node) => node.person.id === "hou-baolin")!;
    const lowerPeer = graph.nodes
      .filter((node) => node.person.generationIndex === 6 && node.y > hou.y)
      .sort((a, b) => a.y - b.y)[0];
    // The compact three-character slip reaches 56px below center; its caption reaches
    // another 50px. The next person's two-line label must clear that caption.
    expect(lowerPeer.y - lowerPeer.height / 2).toBeGreaterThan(hou.y + 106);
  });

  it("retains multiple mentors and gives empty or invalid selections a safe fallback", () => {
    const pair = people.filter((person) =>
      ["zhu-kuoquan", "hou-baolin", "ma-ji"].includes(person.id),
    );
    const graph = buildAtlas({
      ...base,
      people: pair,
      selectedId: "ma-ji",
      edges: [
        {
          id: "first",
          from: "hou-baolin",
          to: "ma-ji",
          type: "mentor",
          sources: [],
          disputed: true,
        },
        {
          id: "second",
          from: "zhu-kuoquan",
          to: "ma-ji",
          type: "mentor",
          sources: [],
        },
      ],
    });
    expect(graph.edges.map((edge) => edge.from).sort()).toEqual([
      "hou-baolin",
      "zhu-kuoquan",
    ]);
    expect(graph.edges.find((edge) => edge.id === "first")?.disputed).toBe(
      true,
    );
    expect(
      buildAtlas({ ...base, selectedId: "missing" }).nodes.some(
        (node) => node.selected,
      ),
    ).toBe(true);
    expect(buildAtlas({ ...base, people: [] }).nodes).toEqual([]);
  });

  it.each(["tree", "scroll"] as const)(
    "fits the four-generation introduction inside a 945px %s stage without shrinking labels",
    (mode) => {
      const graph = buildAtlas({ ...base, mode, viewportWidth: 945 });
      const focusIds = [
        "zhu-kuoquan",
        "hou-baolin",
        "ma-ji",
        "shi-shengjie",
        "jiang-kun",
        "feng-gong",
        "zhao-yan",
      ];
      for (const id of focusIds) {
        const node = graph.nodes.find((item) => item.person.id === id)!;
        expect(node.x - node.width / 2).toBeGreaterThan(55);
        expect(node.x + node.width / 2).toBeLessThan(925);
        expect(node.y).toBeGreaterThanOrEqual(mode === "tree" ? 230 : 280);
        expect(node.y).toBeLessThanOrEqual(mode === "tree" ? 460 : 485);
      }
      const hou = graph.nodes.find((node) => node.person.id === "hou-baolin")!;
      expect(hou.width).toBeLessThanOrEqual(48);
      expect(hou.height - 100).toBeLessThanOrEqual(114);
      expect(
        graph.nodes.find((node) => node.person.id === "ma-ji")!.x - hou.x,
      ).toBeGreaterThanOrEqual(190);
    },
  );

  it("opens no more than three initial disciples outside the featured Hou branch", () => {
    const graph = buildAtlas({ ...base, selectedId: "ma-ji" });
    expect(
      graph.edges
        .filter((edge) => edge.from === "ma-ji")
        .map((edge) => edge.to)
        .sort(),
    ).toEqual(["feng-gong", "jiang-kun", "zhao-yan"]);
    expect(
      graph.nodes.find((node) => node.person.id === "ma-ji")?.hiddenChildren,
    ).toBeGreaterThan(0);
  });

  it("labels an unknown generation as undetermined rather than inventing a numbered generation", () => {
    const unknown = {
      ...people[0],
      id: "unknown",
      name: "待考人物",
      generation: null,
      generationIndex: 10,
    };
    const graph = buildAtlas({
      ...base,
      people: [unknown],
      edges: [],
      selectedId: "unknown",
    });
    expect(graph.columns[0].label).toBe("世代待考");
  });

  it("places the mobile focus and direct disciples above the bottom legend at full text size", () => {
    const viewport = { width: 358, height: 580 };
    const graph = buildAtlas({
      ...base,
      mode: "scroll",
      viewportWidth: viewport.width,
    });
    const selected = graph.nodes.find((node) => node.selected)!;
    const camera = focusAtlasCamera(viewport, selected);
    expect(camera.scale).toBe(1);
    expect(camera.y).toBeLessThanOrEqual(-80);
    expect(camera.y).toBeGreaterThanOrEqual(-105);
    expect(
      selected.y + (selected.height - 100) / 2 + 50 + camera.y,
    ).toBeLessThan(viewport.height - 190);
    for (const id of ["ma-ji", "shi-shengjie"]) {
      const node = graph.nodes.find((item) => item.person.id === id)!;
      expect(node.y + node.height / 2 + camera.y).toBeLessThan(
        viewport.height - 190,
      );
    }
    expect(focusAtlasCamera({ width: 945, height: 650 }, selected)).toEqual({
      x: 0,
      y: 0,
      scale: 1,
    });
  });

  it("preserves the last visible viewport when a book or timeline hides the graph", () => {
    const previous = { width: 945, height: 650 };
    expect(measureAtlasViewport(previous, { width: 0, height: 0 })).toBe(
      previous,
    );
    expect(measureAtlasViewport(previous, { width: 945, height: 0 })).toBe(
      previous,
    );
    expect(measureAtlasViewport(previous, { width: 0, height: 650 })).toBe(
      previous,
    );
    expect(measureAtlasViewport(previous, { width: 945, height: 650 })).toBe(
      previous,
    );
    expect(measureAtlasViewport(previous, { width: 358, height: 580 })).toEqual(
      { width: 358, height: 580 },
    );
  });

  it("uses vertical slips only for the selected person and immediate primary lineage in tree mode", () => {
    const tree = buildAtlas({ ...base, viewportWidth: 945 });
    expect(
      tree.nodes
        .filter((node) => node.vertical)
        .map((node) => node.person.id)
        .sort(),
    ).toEqual(["hou-baolin", "ma-ji", "zhu-kuoquan"]);
    expect(
      tree.nodes.find((node) => node.person.id === "hou-baolin")?.caption,
    ).toBe("1917—1993");
    expect(
      tree.nodes.find((node) => node.person.id === "ma-ji")?.width,
    ).toBeLessThanOrEqual(48);
    const ma = tree.nodes.find((node) => node.person.id === "ma-ji")!;
    const shi = tree.nodes.find((node) => node.person.id === "shi-shengjie")!;
    expect(shi.y - ma.y).toBeGreaterThanOrEqual(
      (ma.height + shi.height) / 2 + 12,
    );
    const scroll = buildAtlas({ ...base, mode: "scroll", viewportWidth: 945 });
    expect(
      scroll.nodes
        .filter((node) => node.vertical)
        .map((node) => node.person.id),
    ).toEqual(["hou-baolin"]);
    expect(tree.nodes.find((node) => node.person.id === "hou-baolin")!.y).toBe(
      scroll.nodes.find((node) => node.person.id === "hou-baolin")!.y - 45,
    );
  });

  it("moves the vertical mainline with selection and does not invent unknown life dates", () => {
    const ma = buildAtlas({ ...base, selectedId: "ma-ji" });
    expect(
      ma.nodes
        .filter((node) => node.vertical)
        .map((node) => node.person.id)
        .sort(),
    ).toEqual(["hou-baolin", "jiang-kun", "ma-ji"]);
    const unknown = {
      ...people[0],
      id: "undated",
      name: "待考人物",
      birthYear: null,
      deathYear: null,
    };
    const graph = buildAtlas({
      ...base,
      people: [unknown],
      edges: [],
      selectedId: "undated",
    });
    expect(graph.nodes[0].caption).toBe("生卒年待考");
  });
});
