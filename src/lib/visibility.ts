import type { GenerationName, Person } from '../types';
import { filterByGeneration, searchPeople } from './catalog';

export function visiblePeople(
  query: string,
  generations: GenerationName[],
): Person[] {
  return filterByGeneration(searchPeople(query), generations);
}

export function visibleIdSet(
  query: string,
  generations: GenerationName[],
  extras: string[] = [],
): Set<string> | null {
  if (!query.trim() && generations.length === 0) return null;
  const ids = new Set(visiblePeople(query, generations).map((person) => person.id));
  for (const id of extras) ids.add(id);
  return ids;
}
