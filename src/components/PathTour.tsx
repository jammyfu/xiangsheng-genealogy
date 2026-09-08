import { tourPaths } from '../lib/catalog';

interface PathTourProps {
  pathId: string;
  stepIndex: number;
  onPath: (id: string) => void;
  onStep: (index: number) => void;
}

export function PathTour({ pathId, stepIndex, onPath, onStep }: PathTourProps) {
  const path = tourPaths.find((item) => item.id === pathId) ?? tourPaths[0];

  return (
    <div className="path-tour">
      <div className="path-switch">
        {tourPaths.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === path.id ? 'is-on' : ''}
            onClick={() => onPath(item.id)}
          >
            {item.title}
          </button>
        ))}
      </div>
      <p className="path-sub">{path.subtitle}</p>
      <div className="path-nav">
        <button type="button" onClick={() => onStep(Math.max(0, stepIndex - 1))}>
          上一站
        </button>
        <button
          type="button"
          onClick={() => onStep(Math.min(path.stops.length - 1, stepIndex + 1))}
        >
          下一站
        </button>
        <span>
          {stepIndex + 1} / {path.stops.length}
        </span>
      </div>
    </div>
  );
}
