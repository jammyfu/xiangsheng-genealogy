import { expect, it } from 'vitest';
import { lineageFocus } from './lineage-focus';
const edges = [
  { id:'ab',from:'a',to:'b' }, { id:'bc',from:'b',to:'c' },
  { id:'cd',from:'c',to:'d' }, { id:'de',from:'d',to:'e' },
  { id:'bx',from:'b',to:'x' }, { id:'xy',from:'x',to:'y' },
];
it('activates all upstream and downstream paths without leaking into a sibling branch', () => {
  const result = lineageFocus('c', edges);
  expect([...result.links].sort()).toEqual(['ab','bc','cd','de']);
  expect([...result.nodes].sort()).toEqual(['a','b','c','d','e']);
});
it('recomputes the full highlighted lineage when selection changes and tolerates cycles', () => {
  const result = lineageFocus('x', [...edges, {id:'ya',from:'y',to:'a'}]);
  expect(result.links.has('xy')).toBe(true);
  expect(result.links.has('ya')).toBe(true);
  expect(result.nodes.size).toBeLessThanOrEqual(7);
});

it('compares complete paths and identifies common ancestors without joining cousins', async () => {
  const { lineageComparison } = await import('./lineage-focus');
  const result = lineageComparison('c','x',edges);
  expect([...result.compared.links].sort()).toEqual(['ab','bx','xy']);
  expect([...result.sharedLinks]).toEqual(['ab']);
  expect([...result.sharedNodes].sort()).toEqual(['a','b']);
  expect(result.compared.links.has('bc')).toBe(false);
  const cleared = lineageComparison('c',null,edges);
  expect(cleared.compared.links.size).toBe(0);
  expect(cleared.selected.links.size).toBe(4);
});
