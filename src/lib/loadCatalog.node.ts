import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Edge, Person, Source } from '../types';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function loadPeopleFromDisk(): Person[] {
  const dir = path.join(root, 'data/people');
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as Person);
}

export function loadEdgesFromDisk(): Edge[] {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'data/edges.json'), 'utf8')) as {
    edges: Edge[];
  };
  return raw.edges;
}

export function loadSourcesFromDisk(): Source[] {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'data/sources.json'), 'utf8')) as {
    sources: Source[];
  };
  return raw.sources;
}
