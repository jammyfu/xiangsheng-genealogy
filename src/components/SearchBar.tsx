import { searchPeople } from '../lib/catalog';

interface SearchBarProps {
  query: string;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
}

export function SearchBar({ query, onQuery, onSelect }: SearchBarProps) {
  const hits = query.trim() ? searchPeople(query).slice(0, 8) : [];

  return (
    <div className="search">
      <label>
        <span>检索</span>
        <input
          type="search"
          value={query}
          placeholder="姓名、艺名、拉丁 id"
          onChange={(event) => onQuery(event.target.value)}
        />
      </label>
      {hits.length ? (
        <ul className="search-hits">
          {hits.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(person.id);
                  onQuery(person.name);
                }}
              >
                <strong>{person.name}</strong>
                <em>{person.generation ? `${person.generation}字辈` : '无字辈'}</em>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
