// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation, Routes, Route } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { Studio } from './Studio';
vi.mock('./AtlasGraph', () => ({ AtlasGraph: () => <div>图谱</div> }));
vi.mock('../lib/useStudioMotion', () => ({ useStudioMotion: () => false }));
vi.mock('./PersonBook', () => ({ PersonBook: () => <div>书笺</div>, lifespan: () => '' }));
vi.mock('./TimelineView', () => ({ TimelineView: () => <div>年表</div> }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
function Harness() { const location = useLocation(); return <><output>{location.pathname + location.search}</output><Routes><Route path="/p/:id" element={<Studio />} /></Routes></>; }
async function mount(url: string) { host = document.createElement('div'); document.body.append(host); root = createRoot(host); await act(async () => root.render(<MemoryRouter initialEntries={[url]}><Harness /></MemoryRouter>)); }
async function click(text: string) { const button = [...host.querySelectorAll('button')].find(b => b.textContent === text)!; expect(button).toBeTruthy(); await act(async () => button.click()); }
const url = () => host.querySelector('output')!.textContent;
afterEach(async () => { await act(async () => root?.unmount()); host?.remove(); });
it('clears a completed search, retains generation, and returns to the previous person and view after switching views', async () => {
  await mount('/p/guo-degang?view=scroll&q=郭&gen=明');
  const summary = host.querySelector<HTMLElement>('.person-summary')!;
  summary.scrollTop = 200;
  await click('侯耀文');
  expect(summary.scrollTop).toBe(0);
  expect(url()).toBe('/p/hou-yaowen?view=scroll&gen=%E6%98%8E');
  await click('人物书笺');
  await click('← 返回郭德纲');
  expect(url()).toBe('/p/guo-degang?view=scroll&q=郭&gen=明');
  await click('侯耀文');
  await click('赵佩茹');
  await click('← 返回侯耀文');
  await click('← 返回郭德纲');
  expect(url()).toContain('/p/guo-degang?view=scroll');
});
it('opens the index with current query and makes the background inert until Escape closes it', async () => {
  await mount('/p/guo-degang?q=郭'); await click('寻人');
  expect(host.querySelector('.studio-content')!.hasAttribute('inert')).toBe(true);
  expect((host.querySelector('[aria-label="检索人物索引"]') as HTMLInputElement).value).toBe('郭');
  await act(async () => host.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true})));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement?.textContent).toBe('寻人');
  expect(host.querySelector('.studio-content')!.hasAttribute('inert')).toBe(false);
});
