import { expect, it } from 'vitest';
import { layoutTreeLabels } from './tree-label-layout';
it('repositions a dense branch without dropping its names', () => {
  const labels = Array.from({length:98}, (_,i) => ({id:String(i),x:450,y:240,width:60,height:28,priority:i===0?100:20}));
  const placed = layoutTreeLabels(labels,1000,700);
  expect(placed).toHaveLength(98);
  for (const a of placed) for (const b of placed) if(a.id!==b.id) expect(a.x < b.x+b.width && a.x+a.width>b.x && a.y<b.y+b.height && a.y+a.height>b.y).toBe(false);
});
it('reserves controls and prioritizes the selected name when capacity is exhausted', () => {
  const candidates=[{id:'background',x:30,y:30,width:60,height:28,priority:1},{id:'selected',x:30,y:30,width:60,height:28,priority:100}];
  expect(layoutTreeLabels(candidates,100,90,[{x:0,y:44,width:100,height:46}]).map(p=>p.id)).toEqual(['selected']);
});
