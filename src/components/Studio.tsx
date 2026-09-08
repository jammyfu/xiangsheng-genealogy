import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DEFAULT_PATH_ID, peopleById, tourPaths } from '../lib/catalog';
import { Graph3D } from './Graph3D';
import { PersonPanel } from './PersonPanel';

export function Studio() {
  const { id } = useParams();
  const navigate = useNavigate();
  const selected = id ? (peopleById[id] ?? null) : null;
  const path = tourPaths.find((item) => item.id === DEFAULT_PATH_ID)!;
  const pathIds = useMemo(() => path.stops, [path]);

  const onSelect = (next: string) => {
    navigate(`/p/${next}`);
  };

  return (
    <main className="studio">
      <header className="masthead">
        <div>
          <p className="eyebrow">Xiangsheng Genealogy</p>
          <h1>相声家谱</h1>
        </div>
        <p className="lede">
          墨点为人，墨线为师徒。默认路径：{path.subtitle}。点选人物查看小传与出处。
        </p>
      </header>
      <div className="workspace">
        <section className="graph-frame" aria-label="三维师承图">
          <Graph3D selectedId={selected?.id ?? null} pathIds={pathIds} visibleIds={null} onSelect={onSelect} />
        </section>
        <PersonPanel person={selected} onSelect={onSelect} />
      </div>
    </main>
  );
}
