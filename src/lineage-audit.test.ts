import { expect, it } from 'vitest';
import { loadEdgesFromDisk, loadPeopleFromDisk } from './lib/loadCatalog.node';

const edges = loadEdgesFromDisk();
const people = loadPeopleFromDisk();
const edge = (from: string, to: string) => edges.find(e => e.from === from && e.to === to);

it('separates family teaching from corrected formal apprenticeships', () => {
  for (const [from, to] of [['gao-yingpei', 'su-mingjie'], ['li-shouzeng', 'zhang-zhenqi'], ['wang-fengshan', 'ma-liujia'], ['zhou-deshan', 'ma-sanli']]) {
    expect(edge(from, to)?.disputed, `${from} → ${to}`).toBe(false);
  }
  for (const [from, to] of [['su-wenmao', 'su-mingjie'], ['guo-rongqi', 'zhang-zhenqi'], ['huang-zumin', 'ma-liujia'], ['ma-delu', 'ma-sanli']]) {
    expect(edge(from, to)).toBeUndefined();
  }
});

it('preserves independently sourced conflicting early lineages', () => {
  for (const [to, a, b] of [['chun-changlong', 'a-yantao', 'zhu-shaowen'], ['feng-kunzhi', 'shen-chunhe', 'zhu-shaowen'], ['fan-ruiting', 'fu-yougen', 'shen-zhushan'], ['lu-dejun', 'xu-youlu', 'shen-zhushan']]) {
    expect(edge(a, to)?.disputed).toBe(true);
    expect(edge(b, to)?.disputed).toBe(true);
    expect(edge(b, to)?.sources).toContain('src-cctv-lineage-20070624');
  }
});

it('keeps the newly connected branches and study cohorts in their lineage generation', () => {
  expect(edge('fan-ruiting', 'jiao-shouhai')).toBeDefined();
  expect(edge('zheng-wenxi', 'wang-sheng')).toBeDefined();
  expect(edge('zheng-xiaoshan', 'miao-fu')).toBeDefined();
  for (const id of ['shao-bing', 'zhang-helun', 'meng-hetang', 'lang-heyan', 'zhou-jiuliang']) {
    expect(edge('guo-degang', id)).toBeDefined();
    expect(people.find(p => p.id === id)?.generationIndex).toBe(9);
  }
});

it('connects the cited Fan Zhenyu disciple branch without mixing in other art forms', () => {
  const disciples = edges.filter(edge => edge.from === 'fan-zhenyu');
  expect(disciples).toHaveLength(13);
  for (const disciple of disciples) {
    expect(disciple.sources).toContain('src-cctv-fan-zhenyu-disciples-20061220');
    expect(people.find(person => person.id === disciple.to)?.generationIndex).toBe(8);
  }
  expect(people.find(person => person.id === 'yu-zhiyong')?.aliases).toContain('于志远');
  expect(edge('fan-zhenyu', 'yu-zhiyong')?.disputed).toBe(true);
});

it('keeps the four newly researched contemporary lineages distinct by art form and evidence', () => {
  expect(edge('wang-qianxiang', 'jin-fei')?.disputed).toBe(false);
  expect(edge('li-shaojie', 'jin-fei')?.note).toContain('快板');
  expect(edge('kang-guisheng', 'chen-xi')?.disputed).toBe(false);
  expect(edge('wei-yuancheng', 'yu-hao')?.disputed).toBe(false);
  expect(edge('zheng-hongwei', 'lu-xin')?.disputed).toBe(true);
});

it('separates confirmed, disputed, and rejected entries in the new lineage survey', () => {
  expect(edge('wang-qianxiang', 'li-yinfei')?.disputed).toBe(false);
  expect(edge('wang-qianxiang', 'ye-peng')?.disputed).toBe(false);

  for (const [from, to] of [
    ['liu-junjie', 'zhang-fengyan'],
    ['liu-junjie', 'zhang-bin'],
    ['xia-jinhua', 'wang-chaozheng'],
    ['wang-peiyuan', 'meng-qinglong'],
    ['ma-zhiming', 'huang-zumin'],
    ['ma-zhiming', 'lu-fulai'],
    ['ma-zhiming', 'yu-kezhi'],
  ]) {
    expect(edge(from, to)?.disputed, `${from} → ${to}`).toBe(true);
  }

  expect(edge('ma-zhiming', 'pan-guicai')).toBeUndefined();
  expect(edge('ma-zhiming', 'wang-jindong')).toBeUndefined();
});

it('keeps Zheng Hongwei’s formal lineage separate from family teaching and the cleared Lu Xin link', () => {
  expect(edge('wang-benlin', 'zheng-xiaoshan')?.disputed).toBe(false);
  expect(edge('zheng-xiaoshan', 'zheng-hongwei')?.disputed).toBe(false);
  expect(edge('zheng-wenxi', 'zheng-hongwei')).toBeUndefined();
  expect(edge('zheng-hongwei', 'lu-xin')?.disputed).toBe(true);
  expect(edge('zheng-hongwei', 'lu-xin')?.note).toContain('解除');
});
