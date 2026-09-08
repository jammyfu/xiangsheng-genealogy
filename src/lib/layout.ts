import type { Edge, GraphNode, Person } from '../types';

const COLUMN = 4.6;
const ROW = 1.35;

export function layoutGraph(people: Person[], edges: Edge[]): GraphNode[] {
  const byId = new Map(people.map((person) => [person.id, person]));
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();

  for (const edge of edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) continue;
    const list = children.get(edge.from) ?? [];
    list.push(edge.to);
    children.set(edge.from, list);
    const ups = parents.get(edge.to) ?? [];
    ups.push(edge.from);
    parents.set(edge.to, ups);
  }

  const yOf = new Map<string, number>();
  const zOf = new Map<string, number>();
  const generations = [...new Set(people.map((person) => person.generationIndex))].sort(
    (a, b) => a - b,
  );

  for (const gen of generations) {
    const cohort = people
      .filter((person) => person.generationIndex === gen)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans'));

    const used = new Set<number>();
    cohort.forEach((person, index) => {
      const ups = (parents.get(person.id) ?? [])
        .map((id) => yOf.get(id))
        .filter((value): value is number => value !== undefined);
      const base = ups.length ? ups.reduce((sum, value) => sum + value, 0) / ups.length : 0;
      let y = ups.length ? base + (index % 2 === 0 ? 0.35 : -0.35) : (index - (cohort.length - 1) / 2) * ROW;
      while ([...used].some((taken) => Math.abs(taken - y) < 0.7)) {
        y += index % 2 === 0 ? 0.75 : -0.75;
      }
      used.add(y);
      yOf.set(person.id, y);
      const school = person.school ?? '';
      const z = school.includes('天津') ? 1.4 : school.includes('德云') ? -1.6 : school.includes('湖南') ? 0.8 : 0;
      zOf.set(person.id, z + ((index % 5) - 2) * 0.18);
    });
  }

  return people.map((person) => ({
    person,
    x: (person.generationIndex - 5) * COLUMN,
    y: yOf.get(person.id) ?? 0,
    z: zOf.get(person.id) ?? 0,
  }));
}

export function nodeMap(nodes: GraphNode[]): Map<string, GraphNode> {
  return new Map(nodes.map((node) => [node.person.id, node]));
}
