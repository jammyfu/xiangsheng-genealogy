import { describe, expect, it } from "vitest";
import Ajv from "ajv/dist/2020.js";
import personSchema from "../data/schemas/person.schema.json";
import edgesSchema from "../data/schemas/edges.schema.json";
import sourcesSchema from "../data/schemas/sources.schema.json";
import {
  loadEdgesFromDisk,
  loadPeopleFromDisk,
  loadSourcesFromDisk,
} from "./lib/loadCatalog.node";

const GENERATIONS = ["德", "寿", "宝", "文", "明"] as const;

describe("maintained catalog", () => {
  const people = loadPeopleFromDisk();
  const edges = loadEdgesFromDisk();
  const sources = loadSourcesFromDisk();
  const ids = new Set(people.map((person) => person.id));
  const sourceIds = new Set(sources.map((source) => source.id));

  it("keeps the generation poem 德寿宝文明", () => {
    expect(GENERATIONS.join("")).toBe("德寿宝文明");
    expect(GENERATIONS.join("")).not.toBe("德寿喜哈");
  });

  it("retains at least the 105 original cited people", () => {
    expect(people.length).toBeGreaterThanOrEqual(105);
  });

  it("validates people, edges and sources against JSON Schema", () => {
    const ajv = new Ajv({ allErrors: true });
    const validatePerson = ajv.compile(personSchema);
    const validateEdges = ajv.compile(edgesSchema);
    const validateSources = ajv.compile(sourcesSchema);

    for (const person of people) {
      expect(
        validatePerson(person),
        JSON.stringify(validatePerson.errors),
      ).toBe(true);
    }
    expect(validateEdges({ edges }), JSON.stringify(validateEdges.errors)).toBe(
      true,
    );
    expect(
      validateSources({ sources }),
      JSON.stringify(validateSources.errors),
    ).toBe(true);
  });

  it("keeps mentor edges pointing at existing people and sources", () => {
    // A sourced person may have no verified mentor; never invent edges for coverage.
    expect(new Set(edges.map((edge) => edge.id)).size).toBe(edges.length);
    for (const edge of edges) {
      expect(ids.has(edge.from), edge.from).toBe(true);
      expect(ids.has(edge.to), edge.to).toBe(true);
      expect(edge.from).not.toBe(edge.to);
      for (const source of edge.sources) {
        expect(sourceIds.has(source), source).toBe(true);
      }
    }
  });

  it("keeps mentor pairs unique and lineage free of cycles", () => {
    expect(new Set(edges.map((edge) => `${edge.from}--${edge.to}`)).size).toBe(
      edges.length,
    );
    const children = new Map<string, string[]>();
    for (const edge of edges) {
      children.set(edge.from, [...(children.get(edge.from) ?? []), edge.to]);
    }
    const visited = new Set<string>();
    const active = new Set<string>();
    const visit = (id: string) => {
      expect(active.has(id), `mentor cycle at ${id}`).toBe(false);
      if (visited.has(id)) return;
      active.add(id);
      for (const child of children.get(id) ?? []) visit(child);
      active.delete(id);
      visited.add(id);
    };
    for (const id of ids) visit(id);
  });

  it("separates verified apprenticeship from guidance, partnership and other arts", () => {
    const has = (from: string, to: string) =>
      edges.some((edge) => edge.from === from && edge.to === to);
    expect(has("zhang-shouchen", "tian-lihe")).toBe(true);
    expect(has("liu-baorui", "xing-wenzhao")).toBe(true);
    expect(has("yang-haiquan", "yang-zhenhua")).toBe(true);
    expect(has("yang-zhenhua", "ji-yuan")).toBe(true);
    expect(has("chen-yian", "ye-yijun")).toBe(true);
    expect(has("wei-wenliang", "zhu-degang")).toBe(true);
    expect(edges.some((edge) => edge.to === "wei-longhao")).toBe(false);
    expect(has("wu-zhaonan", "chen-yian")).toBe(false);
    expect(has("tian-lianyuan", "ye-yijun")).toBe(false);
    const wu = people.find((person) => person.id === "wu-zhaonan");
    expect(wu?.birthYear).toBeNull();
    expect(wu?.bio).toContain("出生年有异说");
    expect(
      people.find((person) => person.id === "ding-guangquan")?.deathYear,
    ).toBe(2018);
    expect(edges.find((edge) => edge.to === "zhu-degang")?.note).toContain(
      "年份本次未核定",
    );
    expect(
      edges.find(
        (edge) => edge.from === "zhu-kuoquan" && edge.to === "ma-zhiming",
      )?.note,
    ).toContain("不表示朱阔泉直接面授");
  });

  it("cites a source on every person and never hosts audio", () => {
    for (const person of people) {
      expect(person.sources.length).toBeGreaterThan(0);
      for (const source of person.sources) {
        expect(sourceIds.has(source), `${person.id} ${source}`).toBe(true);
      }
      expect(person.portraitKind).toMatch(/placeholder|public-domain|external/);
      expect(JSON.stringify(person)).not.toMatch(/audio\/|\\.mp3|\\.wav/);
    }
  });

  it("includes the default Zhu–Hou–Ma path and the Ma Sanli contrast path", () => {
    for (const id of [
      "zhu-kuoquan",
      "hou-baolin",
      "ma-ji",
      "jiang-kun",
      "zhou-deshan",
      "ma-sanli",
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
    const has = (from: string, to: string) =>
      edges.some((edge) => edge.from === from && edge.to === to);
    expect(has("zhu-kuoquan", "hou-baolin")).toBe(true);
    expect(has("hou-baolin", "ma-ji")).toBe(true);
    expect(has("ma-ji", "jiang-kun")).toBe(true);
    expect(has("zhou-deshan", "ma-sanli")).toBe(true);
  });

  it("keeps distinct people and source identifiers", () => {
    expect(ids.size).toBe(people.length);
    expect(sourceIds.size).toBe(sources.length);
    const cao = people.find((person) => person.id === "cao-heyang");
    expect(cao?.aliases ?? []).not.toContain("曹云金");
  });

  it("does not duplicate a person under their primary name and alias", () => {
    const owners = new Map<string, string>();
    for (const person of people) {
      for (const name of new Set([person.name, person.nameHant, ...(person.aliases ?? [])])) {
        if (!name) continue;
        const key = name.normalize("NFKC").trim();
        expect(owners.get(key) ?? person.id, `${key} belongs to two people`).toBe(person.id);
        owners.set(key, person.id);
      }
    }
    expect(ids.has("zhu-yunfeng")).toBe(false);
    expect(people.find(person => person.id === "shao-bing")?.aliases).toContain("朱云峰");
  });

  it("keeps mixed-art ceremonies outside confirmed crosstalk mentor edges", () => {
    for (const id of ["duan-yanxi", "song-minghan", "wu-yinjie"]) {
      expect(edges.some(edge => edge.from === "ye-yijun" && edge.to === id)).toBe(false);
    }
    expect(edges.find(edge => edge.to === "ji-tianyu")?.from).toBe("liu-zengkai");
    expect(edges.find(edge => edge.to === "wu-yongfeng")?.from).toBe("hou-guanqun");
    expect(edges.find(edge => edge.to === "yao-xinguang")?.disputed).toBe(false);
  });

  it("flags disputed lineage where the table is unsettled", () => {
    const disputedPeople = people.filter((person) => person.disputed);
    const disputedEdges = edges.filter((edge) => edge.disputed);
    expect(disputedPeople.length).toBeGreaterThan(0);
    expect(disputedEdges.length).toBeGreaterThan(0);
  });
});
