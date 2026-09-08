import { GENERATIONS, type GenerationName } from '../types';

interface GenerationFilterProps {
  selected: GenerationName[];
  onToggle: (generation: GenerationName) => void;
}

export function GenerationFilter({ selected, onToggle }: GenerationFilterProps) {
  return (
    <fieldset className="gen-filter">
      <legend>字辈</legend>
      {GENERATIONS.map((generation) => {
        const active = selected.includes(generation);
        return (
          <button
            key={generation}
            type="button"
            className={active ? 'is-on' : ''}
            aria-pressed={active}
            onClick={() => onToggle(generation)}
          >
            {generation}
          </button>
        );
      })}
    </fieldset>
  );
}
