import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DEFAULT_PATH_ID, peopleById, tourPaths } from '../lib/catalog';
import { usePrefersPlainGraph } from '../lib/useMedia';
import { visibleIdSet } from '../lib/visibility';
import type { GenerationName } from '../types';
import { GenerationFilter } from './GenerationFilter';
import { Graph3D } from './Graph3D';
import { PaperGraph } from './PaperGraph';
import { PathTour } from './PathTour';
import { PersonPanel } from './PersonPanel';
import { SearchBar } from './SearchBar';

export function Studio() {
  const { id } = useParams();
  const navigate = useNavigate();
  const plain = usePrefersPlainGraph();
  const selected = id ? (peopleById[id] ?? null) : null;
  const [query, setQuery] = useState('');
  const [generations, setGenerations] = useState<GenerationName[]>([]);
  const [pathId, setPathId] = useState(DEFAULT_PATH_ID);
  const [stepIndex, setStepIndex] = useState(0);

  const path = tourPaths.find((item) => item.id === pathId) ?? tourPaths[0];
  const pathIds = path.stops;
  const visibleIds = useMemo(() => visibleIdSet(query, generations), [query, generations]);

  useEffect(() => {
    if (id) return;
    navigate(`/p/${path.stops[0]}`, { replace: true });
  }, [id, navigate, path.stops]);

  const onSelect = (next: string) => {
    navigate(`/p/${next}`);
    const idx = path.stops.indexOf(next);
    if (idx >= 0) setStepIndex(idx);
  };

  const onPath = (next: string) => {
    setPathId(next);
    setStepIndex(0);
    const first = tourPaths.find((item) => item.id === next)?.stops[0];
    if (first) navigate(`/p/${first}`);
  };

  const onStep = (index: number) => {
    setStepIndex(index);
    const stop = path.stops[index];
    if (stop) navigate(`/p/${stop}`);
  };

  const toggleGen = (generation: GenerationName) => {
    setGenerations((current) =>
      current.includes(generation)
        ? current.filter((item) => item !== generation)
        : [...current, generation],
    );
  };

  return (
    <main className="studio">
      <div className="paper-grain" aria-hidden="true" />
      <header className="masthead">
        <div className="brand">
          <p className="eyebrow">Xiangsheng Genealogy</p>
          <h1>相声家谱</h1>
          <p className="colophon">墨点为人 · 墨线为师徒 · 德寿宝文明</p>
        </div>
        <div className="tools">
          <SearchBar query={query} onQuery={setQuery} onSelect={onSelect} />
          <GenerationFilter selected={generations} onToggle={toggleGen} />
          <PathTour pathId={pathId} stepIndex={stepIndex} onPath={onPath} onStep={onStep} />
        </div>
        <div className="seal mast-seal" aria-hidden="true">
          谱
        </div>
      </header>
      <div className="workspace">
        <section className="graph-frame" aria-label={plain ? '宣纸师承图' : '三维师承图'}>
          {plain ? (
            <PaperGraph
              selectedId={selected?.id ?? null}
              pathIds={pathIds}
              visibleIds={visibleIds}
              onSelect={onSelect}
            />
          ) : (
            <Graph3D
              selectedId={selected?.id ?? null}
              pathIds={pathIds}
              visibleIds={visibleIds}
              onSelect={onSelect}
            />
          )}
        </section>
        <PersonPanel person={selected} onSelect={onSelect} />
      </div>
    </main>
  );
}
