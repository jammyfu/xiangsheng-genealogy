import type { Edge, Person, Source, TourPath } from '../types';
import edgesFile from '../../data/edges.json';
import sourcesFile from '../../data/sources.json';

const personModules = import.meta.glob('../../data/people/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Person>;

const edgesModule = edgesFile as { edges: Edge[] };
const sourcesModule = sourcesFile as { sources: Source[] };

export const people: Person[] = Object.values(personModules).sort((a, b) => {
  if (a.generationIndex !== b.generationIndex) {
    return a.generationIndex - b.generationIndex;
  }
  return a.name.localeCompare(b.name, 'zh-Hans');
});

export const peopleById: Record<string, Person> = Object.fromEntries(
  people.map((person) => [person.id, person]),
);

export const edges: Edge[] = edgesModule.edges;
export const sources: Source[] = sourcesModule.sources;
export const sourcesById: Record<string, Source> = Object.fromEntries(
  sources.map((source) => [source.id, source]),
);

export const DEFAULT_PATH_ID = 'zhu-hou-ma';

export const tourPaths: TourPath[] = [
  {
    id: DEFAULT_PATH_ID,
    title: '朱阔泉一脉',
    subtitle: '朱阔泉 → 侯宝林 → 马季 → 传人',
    stops: ['zhu-kuoquan', 'hou-baolin', 'ma-ji', 'jiang-kun', 'feng-gong', 'zhao-yan'],
  },
  {
    id: 'ma-sanli',
    title: '马三立对照',
    subtitle: '周德山 → 马三立 → 传人',
    stops: ['zhou-deshan', 'ma-sanli', 'yan-xiaoru', 'chang-baohua', 'li-wenhua'],
  },
];

export function disciplesOf(id: string): Person[] {
  return edges
    .filter((edge) => edge.from === id)
    .map((edge) => peopleById[edge.to])
    .filter(Boolean);
}

export function mentorsOf(id: string): Person[] {
  return edges
    .filter((edge) => edge.to === id)
    .map((edge) => peopleById[edge.from])
    .filter(Boolean);
}

export function searchPeople(query: string): Person[] {
  const q = query.trim().toLowerCase();
  if (!q) return people;
  return people.filter((person) => {
    const hay = [person.name, person.nameHant, ...(person.aliases ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q) || person.id.includes(q);
  });
}

export function filterByGeneration(
  list: Person[],
  gens: Array<Person['generation']>,
): Person[] {
  if (gens.length === 0) return list;
  return list.filter((person) => gens.includes(person.generation));
}
