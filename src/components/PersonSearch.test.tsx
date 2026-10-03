// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { PersonSearch } from './PersonSearch';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
afterEach(async () => { await act(async () => root?.unmount()); host?.remove(); });
it('supports arrow selection, Escape dismissal, and prevents closed-popup Enter from selecting', async () => {
  const select = vi.fn(); host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<PersonSearch query="侯" onQuery={() => {}} onSelect={select} onDirectory={() => {}} />));
  const input = host.querySelector('input')!;
  const key = async (key: string) => act(async () => input.dispatchEvent(new KeyboardEvent('keydown', {key,bubbles:true})));
  await key('ArrowDown'); await key('ArrowDown');
  const option = host.querySelector('[aria-selected="true"]')!;
  expect(input.getAttribute('aria-activedescendant')).toBe(option.id);
  await key('Enter'); expect(select).toHaveBeenCalledWith(option.id.replace('person-search-', ''));
  await key('ArrowDown'); await key('Escape'); await key('Enter');
  expect(input.getAttribute('aria-expanded')).toBe('false'); expect(select).toHaveBeenCalledTimes(1);
});
