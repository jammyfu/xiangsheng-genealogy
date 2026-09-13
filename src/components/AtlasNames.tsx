import { useRef, useState } from 'react';
import type { Person } from '../types';

export function AtlasNames({ people, selectedId, onSelect }: { people: Person[]; selectedId: string; onSelect(id: string): void }) {
  const [query, setQuery] = useState('');
  const details = useRef<HTMLDetailsElement>(null);
  const q = query.trim().toLocaleLowerCase();
  const list = people.filter(p => [p.name, p.id, ...(p.aliases ?? [])].join(' ').toLocaleLowerCase().includes(q));
  const close = () => { if (details.current) { details.current.open = false; details.current.querySelector('summary')?.focus(); } };
  return <details className="atlas-names" ref={details} data-atlas-control="names" onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') close(); }}>
    <summary>人名册 · {people.length}<span>查找与定位</span></summary>
    <div className="atlas-names-body">
      <label>姓名或艺名<input value={query} onChange={e => setQuery(e.target.value)} placeholder="输入姓名，定位到谱中" /></label>
      <p role="status">{list.length} 位 · 收纳的人物也可在此找到</p>
      <div className="atlas-names-list">
        {list.map(p => <button key={p.id} aria-pressed={selectedId === p.id} onClick={() => { onSelect(p.id); close(); }}>
          <strong>{p.name}</strong><span>{p.generation ? `${p.generation}字辈` : `第${p.generationIndex}代`}{p.originalGeneration ? ` · 原${p.originalGeneration}` : ''}{p.disputed ? ' · 存疑' : ''}</span>
        </button>)}
        {!list.length && <p>未找到，试试姓名或艺名。</p>}
      </div>
    </div>
  </details>;
}
