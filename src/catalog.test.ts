import { describe, expect, it } from 'vitest';
import Ajv from 'ajv/dist/2020.js';
import personSchema from '../data/schemas/person.schema.json';
import edgesSchema from '../data/schemas/edges.schema.json';
import sourcesSchema from '../data/schemas/sources.schema.json';
import {
  loadEdgesFromDisk,
  loadPeopleFromDisk,
  loadSourcesFromDisk,
} from './lib/loadCatalog.node';

const GENERATIONS = ['德', '寿', '宝', '文', '明'] as const;

describe('seed catalog', () => {
  const people = loadPeopleFromDisk();
  const edges = loadEdgesFromDisk();
  const sources = loadSourcesFromDisk();
  const ids = new Set(people.map((person) => person.id));
  const sourceIds = new Set(sources.map((source) => source.id));

  it('keeps the generation poem 德寿宝文明', () => {
    expect(GENERATIONS.join('')).toBe('德寿宝文明');
    expect(GENERATIONS.join('')).not.toBe('德寿喜哈');
  });

  it('seeds at least 60 cited people', () => {
    expect(people.length).toBeGreaterThanOrEqual(60);
  });

  it('validates people, edges and sources against JSON Schema', () => {
    const ajv = new Ajv({ allErrors: true });
    const validatePerson = ajv.compile(personSchema);
    const validateEdges = ajv.compile(edgesSchema);
    const validateSources = ajv.compile(sourcesSchema);

    for (const person of people) {
      expect(validatePerson(person), JSON.stringify(validatePerson.errors)).toBe(true);
    }
    expect(validateEdges({ edges }), JSON.stringify(validateEdges.errors)).toBe(true);
    expect(validateSources({ sources }), JSON.stringify(validateSources.errors)).toBe(true);
  });

  it('keeps mentor edges pointing at existing people and sources', () => {
    expect(edges.length).toBeGreaterThanOrEqual(people.length - 5);
    for (const edge of edges) {
      expect(ids.has(edge.from), edge.from).toBe(true);
      expect(ids.has(edge.to), edge.to).toBe(true);
      expect(edge.from).not.toBe(edge.to);
      for (const source of edge.sources) {
        expect(sourceIds.has(source), source).toBe(true);
      }
    }
  });

  it('cites a source on every person and never hosts audio', () => {
    for (const person of people) {
      expect(person.sources.length).toBeGreaterThan(0);
      for (const source of person.sources) {
        expect(sourceIds.has(source), `${person.id} ${source}`).toBe(true);
      }
      expect(person.portraitKind).toMatch(/placeholder|public-domain|external/);
      expect(JSON.stringify(person)).not.toMatch(/audio\/|\\.mp3|\\.wav/);
    }
  });

  it('includes the default Zhu–Hou–Ma path and the Ma Sanli contrast path', () => {
    for (const id of ['zhu-kuoquan', 'hou-baolin', 'ma-ji', 'jiang-kun', 'zhou-deshan', 'ma-sanli']) {
      expect(ids.has(id), id).toBe(true);
    }
    const has = (from: string, to: string) =>
      edges.some((edge) => edge.from === from && edge.to === to);
    expect(has('zhu-kuoquan', 'hou-baolin')).toBe(true);
    expect(has('hou-baolin', 'ma-ji')).toBe(true);
    expect(has('ma-ji', 'jiang-kun')).toBe(true);
    expect(has('zhou-deshan', 'ma-sanli')).toBe(true);
  });

  it('flags disputed lineage where the table is unsettled', () => {
    const disputedPeople = people.filter((person) => person.disputed);
    const disputedEdges = edges.filter((edge) => edge.disputed);
    expect(disputedPeople.length).toBeGreaterThan(0);
    expect(disputedEdges.length).toBeGreaterThan(0);
  });
});
