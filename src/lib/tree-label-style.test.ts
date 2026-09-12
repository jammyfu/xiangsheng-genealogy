import { expect, it } from 'vitest';
import { treeLabelStyle } from './tree-label-style';
it('keeps the backing opaque for every visual state, including muted branches', () => {
  for(const state of [ {selected:true,related:true}, {selected:false,related:true}, {selected:false,related:false}, {selected:false,related:false,compared:true}, {selected:false,related:true,shared:true} ]) {
    const style=treeLabelStyle(state);
    expect(style.opacity).toBe(1);
    expect(style.paper).toMatch(/^#[0-9a-f]{6}$/);
    expect(style.ink).not.toBe(style.paper);
  }
});
it('distinguishes pinned, comparison and background names without obscuring the current person', () => {
  const selected=treeLabelStyle({selected:true,related:true,shared:true});
  const muted=treeLabelStyle({selected:false,related:false});
  const compared=treeLabelStyle({selected:false,related:false,compared:true});
  expect(selected.mode).toBe('selected');
  expect(selected.width).toBeGreaterThan(compared.width);
  expect(compared.width).toBeGreaterThan(muted.width);
  expect(selected.font).not.toBe(muted.font);
  expect(compared.paper).not.toBe(selected.paper);
});
