import { describe, expect, it } from 'vitest';
import { loadEdgesFromDisk, loadPeopleFromDisk } from './loadCatalog.node';
import { layoutGraph } from './layout';

describe('lineage layout', () => {
  it('places every person and keeps generations in columns', () => {
    const people = loadPeopleFromDisk();
    const edges = loadEdgesFromDisk();
    const nodes = layoutGraph(people, edges);
    expect(nodes).toHaveLength(people.length);
    const hou = nodes.find((node) => node.person.id === 'hou-baolin');
    const ma = nodes.find((node) => node.person.id === 'ma-ji');
    const zhu = nodes.find((node) => node.person.id === 'zhu-kuoquan');
    expect(zhu && hou && ma).toBeTruthy();
    expect(zhu!.x).toBeLessThan(hou!.x);
    expect(hou!.x).toBeLessThan(ma!.x);
  });
});
