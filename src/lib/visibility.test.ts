import { describe, expect, it } from 'vitest';
import { searchPeople } from './catalog';
import { loadPeopleFromDisk } from './loadCatalog.node';
import { visiblePeople } from './visibility';

describe('search and generation filters', () => {
  it('finds 侯宝林 by name and keeps 德 filter on 德-generation people', () => {
    const hits = searchPeople('侯宝林');
    expect(hits.some((person) => person.id === 'hou-baolin')).toBe(true);
    const de = visiblePeople('', ['德']);
    expect(de.length).toBeGreaterThan(0);
    expect(de.every((person) => person.generation === '德')).toBe(true);
  });

  it('reads the same people set the 3D graph uses', () => {
    expect(loadPeopleFromDisk().length).toBeGreaterThanOrEqual(60);
  });
});
