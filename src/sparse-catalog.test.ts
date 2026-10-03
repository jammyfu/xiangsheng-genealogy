import { expect, it } from 'vitest';
import { loadEdgesFromDisk, loadPeopleFromDisk } from './lib/loadCatalog.node';
const edges = loadEdgesFromDisk();
const people = loadPeopleFromDisk();
const pair = (from: string, to: string) => edges.find(e => e.from === from && e.to === to);
it('keeps sparse-branch formal mentors distinct from relatives, ceremony proxies and other art forms', () => {
  expect(pair('wang-shichen', 'xie-jin')).toBeDefined();
  expect(pair('li-wenshan', 'xie-jin')).toBeUndefined();
  expect(pair('li-wenshan', 'zhang-deyan')).toBeDefined();
  expect(pair('yang-haiquan', 'jin-bingchang')).toBeDefined();
  expect(pair('yang-zhenhua', 'jin-bingchang')).toBeUndefined();
  expect(pair('tian-lihe', 'cao-yunjin')).toBeUndefined();
  expect(pair('shi-shengjie', 'chen-hanbo')).toBeUndefined();
  expect(pair('su-wenmao', 'su-mingjie')).toBeUndefined();
  expect(pair('shi-shengjie', 'liu-wei-shi')).toBeDefined();
  expect(pair('shi-shengjie', 'liu-wei')).toBeUndefined();
  expect(pair('ma-ji', 'liu-wei')).toBeDefined();
  expect(pair('yin-xiaosheng', 'liu-hui-yin')).toBeDefined();
  expect(pair('yin-xiaosheng', 'liu-hui')).toBeUndefined();
  expect(pair('yang-zhenhua', 'wang-letian')?.disputed).toBe(true);
  expect(pair('zhang-wenbin', 'wei-wenliang')).toBeDefined();
  expect(pair('wu-kuihai', 'wei-wenliang')).toBeDefined();
  expect(people.find(p => p.id === 'shi-shengjie')?.deathYear).toBe(2018);
});
it('keeps Doubao leads separate from independently supported professional relationships', () => {
  expect(pair('zhao-shaofang', 'zhang-yongxi')).toBeDefined();
  expect(pair('yang-zhenhua', 'cui-fuxiang')).toBeDefined();
  for (const id of ['he-baowen', 'chen-jianxiong']) {
    expect(pair('huang-junying', id)?.sources).toHaveLength(2);
    expect(pair('huang-junying', id)?.note).toContain('仪式');
  }
  expect(pair('luo-pinchao', 'huang-junying')).toBeUndefined();
  expect(pair('huang-junying', 'yang-da')).toBeUndefined();
  expect(pair('huang-junying', 'pan-hongbo')).toBeUndefined();
  expect(people.find(p => p.id === 'ji-yuan')?.name).toBe('纪元');
  expect(people.some(p => p.name === '新纪元')).toBe(false);
});
