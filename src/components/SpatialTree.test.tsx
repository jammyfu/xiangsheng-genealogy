// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene, Vector3 } from 'three';
import SpatialTree from './SpatialTree';
import { buildAtlas } from '../lib/atlas';
import { loadPeopleFromDisk, loadEdgesFromDisk } from '../lib/loadCatalog.node';

const mocked = vi.hoisted(() => ({ api: null as unknown, handlers: new Map<string, unknown>() }));
vi.mock('3d-force-graph', () => ({ default: function () { return mocked.api; } }));
vi.mock('../lib/genealogy-stars', () => ({ createGenealogyStars: () => ({ points: new Scene(), dispose: vi.fn(), move: vi.fn(), hover: vi.fn(), burst: vi.fn() }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

it('selects a parent from the graph and directory without collapsing its lineage', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createRadialGradient: () => ({ addColorStop: vi.fn() }), fillRect: vi.fn(),
  } as never);
  Object.defineProperty(document, 'fonts', { configurable: true, value: { load: () => new Promise(() => {}) } });
  const scene = new Scene(), camera = new PerspectiveCamera(38, 2);
  mocked.handlers.clear();
  const cameraPosition = vi.fn();
  const api = new Proxy({}, { get: (_, name: string) => {
    if (name === 'scene') return () => scene;
    if (name === 'camera') return () => camera;
    if (name === 'cameraPosition') return (...args: unknown[]) => { cameraPosition(...args); return args.length ? api : new Vector3(0,0,1000); };
    if (name === 'd3Force') return () => api;
    return (...args: unknown[]) => { if (!args.length) return mocked.handlers.get(name); mocked.handlers.set(name, args[0]); return api; };
  } });
  mocked.api = api;
  const graph = buildAtlas({ people: loadPeopleFromDisk(), edges: loadEdgesFromDisk(), selectedId: 'yin-shoushan', mode: 'tree' });
  const onSelect = vi.fn(), onBranch = vi.fn();
  const element = document.createElement('div'); document.body.append(element);
  const root = createRoot(element);
  const render = (selectedId: string) => root.render(<SpatialTree graph={buildAtlas({ people: loadPeopleFromDisk(), edges: loadEdgesFromDisk(), selectedId, mode:'tree' })} viewport={{width:1200,height:600}} selectedId={selectedId} active onSelect={onSelect} onBranch={onBranch} onFailure={vi.fn()} controlsRef={{current:null}} />);
  try {
    await act(async () => render('yin-shoushan'));
    const parent = graph.nodes.find(n => n.person.id === 'ma-delu')!;
    expect(parent.childCount).toBeGreaterThan(0);
    await act(async () => (mocked.handlers.get('onNodeClick') as (n: {id:string}) => void)({ id:'ma-delu' }));
    expect(onSelect).toHaveBeenLastCalledWith('ma-delu'); expect(onBranch).not.toHaveBeenCalled();
    await act(async () => render('ma-delu'));
    // The camera frames the lineage with space for labels, rather than a fixed 360-unit close-up.
    const [position, target] = cameraPosition.mock.lastCall as [Vector3, Vector3];
    expect(position.distanceTo(target)).toBeGreaterThan(360);
    const graphTab = [...element.querySelectorAll<HTMLButtonElement>('.force-directory-modes button')].find(b => b.textContent?.includes('图中人物'))!;
    await act(async () => graphTab.click());
    const directoryButton = element.querySelector<HTMLButtonElement>('[aria-label="张三禄，查看师承主线"]')!;
    await act(async () => directoryButton.click());
    expect(onSelect).toHaveBeenLastCalledWith('zhang-sanlu'); expect(onBranch).not.toHaveBeenCalled();
    const branchButton = [...element.querySelectorAll<HTMLButtonElement>('.force-tree-actions button')].find(b => /传人/.test(b.textContent ?? ''))!;
    await act(async () => branchButton.click());
    expect(onBranch).toHaveBeenCalledOnce();
    await act(async () => render('guo-degang'));
    const discipleCount = loadEdgesFromDisk().filter(edge => edge.from === 'guo-degang').length;
    expect(discipleCount).toBeGreaterThan(90);
    expect(element.querySelector('.force-tree-directory summary')?.textContent).toContain(`1 / ${discipleCount}`);
    const disciplesTab = [...element.querySelectorAll<HTMLButtonElement>('.force-directory-modes button')].find(b => b.textContent === `弟子 · ${discipleCount}`)!;
    await act(async () => disciplesTab.click());
    // Direct relationships come from the catalog even when most disciples are not in the collapsed graph.
    expect(element.querySelectorAll('.force-directory-list button')).toHaveLength(discipleCount);
    const disciple = element.querySelector<HTMLButtonElement>('[aria-label="岳云鹏，查看师承主线"]')!;
    const details = element.querySelector<HTMLDetailsElement>('.force-tree-directory')!;
    details.open = true;
    await act(async () => disciple.click());
    expect(onSelect).toHaveBeenLastCalledWith('yue-yunpeng');
    expect(onBranch).toHaveBeenCalledOnce();
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(details.querySelector('summary'));

  } finally { await act(async () => root.unmount()); }
});
