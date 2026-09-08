import type { Person } from '../types';
import { disciplesOf, mentorsOf, sourcesById } from '../lib/catalog';

interface PersonPanelProps {
  person: Person | null;
  onSelect: (id: string) => void;
}

function years(person: Person): string {
  if (person.floruit && !person.birthYear) return person.floruit;
  if (person.birthYear && person.deathYear) return `${person.birthYear}–${person.deathYear}`;
  if (person.birthYear) return `${person.birthYear}–`;
  return '年代待考';
}

export function PersonPanel({ person, onSelect }: PersonPanelProps) {
  if (!person) {
    return (
      <aside className="panel empty-panel">
        <p className="seal-mini">谱</p>
        <h2>点一粒墨</h2>
        <p>选中人物后，这里展开小传、字辈、作品标题与出处。本库不托管音频。</p>
      </aside>
    );
  }

  const mentors = mentorsOf(person.id);
  const disciples = disciplesOf(person.id);

  return (
    <aside className="panel person-panel">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">
            {person.generation ? `${person.generation}字辈` : '尚无字辈'}
            <span> · 第{person.generationIndex}代</span>
          </p>
          <h2>{person.name}</h2>
          <p className="panel-meta">
            {years(person)}
            {person.school ? ` · ${person.school}` : ''}
          </p>
        </div>
        <div className="seal" aria-hidden="true">
          {person.generation ?? '谱'}
        </div>
      </div>

      {person.disputed ? <p className="disputed">师承或部辈有异说，已在谱上标记。</p> : null}

      <section>
        <h3>小传</h3>
        <p>{person.bio}</p>
      </section>

      {person.works.length ? (
        <section>
          <h3>作品（仅标题）</h3>
          <ul className="work-list">
            {person.works.map((work) => (
              <li key={work}>{work}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {mentors.length ? (
        <section>
          <h3>师承</h3>
          <p className="chip-row">
            {mentors.map((mentor) => (
              <button type="button" key={mentor.id} onClick={() => onSelect(mentor.id)}>
                {mentor.name}
              </button>
            ))}
          </p>
        </section>
      ) : null}

      {disciples.length ? (
        <section>
          <h3>传人</h3>
          <p className="chip-row">
            {disciples.map((disciple) => (
              <button type="button" key={disciple.id} onClick={() => onSelect(disciple.id)}>
                {disciple.name}
              </button>
            ))}
          </p>
        </section>
      ) : null}

      {person.notes?.length ? (
        <section>
          <h3>按语</h3>
          <ul>
            {person.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3>出处</h3>
        <ul className="source-list">
          {person.sources.map((id) => {
            const source = sourcesById[id];
            if (!source) return <li key={id}>{id}</li>;
            return (
              <li key={id}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
                <span> · {source.publisher}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
