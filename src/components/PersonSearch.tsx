import { useRef, useState } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { searchPeople } from '../lib/catalog';

export function PersonSearch({ query, onQuery, onSelect, onDirectory }: {
  query: string;
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
  onDirectory: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const matches = searchPeople(query);
  const results = matches.slice(0, 9);
  const expanded = open && !!query.trim();
  const choose = (id: string) => { setOpen(false); setActive(-1); onSelect(id); };
  return <div className="search-box" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <MagnifyingGlass size={23} weight="light" />
    <input ref={input} role="combobox" aria-label="搜索人物" aria-autocomplete="list"
      aria-expanded={expanded} aria-controls={expanded ? 'person-search-results' : undefined}
      aria-activedescendant={expanded && active >= 0 ? `person-search-${results[active]?.id}` : undefined}
      placeholder="搜索姓名或艺名" value={query}
      onFocus={() => setOpen(true)}
      onChange={event => { setActive(-1); setOpen(true); onQuery(event.target.value); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); }
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && results.length) {
          event.preventDefault(); setOpen(true);
          setActive(previous => event.key === 'ArrowDown' ? (previous + 1) % results.length : (previous <= 0 ? results.length - 1 : previous - 1));
        }
        if (event.key === 'Enter' && expanded && results.length) {
          event.preventDefault(); choose(results[Math.max(0, active)].id);
        }
      }} />
    {query && <button aria-label="清除搜索" onClick={() => { onQuery(''); setActive(-1); input.current?.focus(); }}><X size={15} /></button>}
    {expanded && <div className="search-results">
      <p role="status">找到 {matches.length} 位人物{matches.length > results.length ? ` · 显示前 ${results.length} 位` : ''}</p>
      <div role="listbox" id="person-search-results" aria-label="人物搜索结果">
        {results.map((person, index) => <button type="button" role="option" tabIndex={-1}
          id={`person-search-${person.id}`} key={person.id} aria-selected={index === active}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(person.id)}>
          <span>{person.name}</span><small>{person.generation ? `${person.generation}字辈` : '字辈待考'}</small>
        </button>)}
      </div>
      {!results.length && <p>暂无匹配，试试姓名、艺名或拼音标识。</p>}
      {matches.length > results.length && <button onClick={() => { setOpen(false); onDirectory(); }}>查看全部 {matches.length} 位结果</button>}
    </div>}
  </div>;
}
