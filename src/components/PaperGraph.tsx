import { useMemo } from 'react';
import { edges, people } from '../lib/catalog';
import { layoutGraph } from '../lib/layout';

interface PaperGraphProps {
  selectedId: string | null;
  pathIds: string[];
  visibleIds: Set<string> | null;
  onSelect: (id: string) => void;
}

export function PaperGraph({ selectedId, pathIds, visibleIds, onSelect }: PaperGraphProps) {
  const nodes = useMemo(() => layoutGraph(people, edges), []);
  const shown = nodes.filter((node) => !visibleIds || visibleIds.has(node.person.id));
  const xs = shown.map((node) => node.x);
  const ys = shown.map((node) => node.y);
  const minX = Math.min(...xs, 0) - 2;
  const maxX = Math.max(...xs, 1) + 2;
  const minY = Math.min(...ys, 0) - 2;
  const maxY = Math.max(...ys, 1) + 2;
  const width = maxX - minX;
  const height = maxY - minY;
  const lookup = new Map(shown.map((node) => [node.person.id, node]));

  return (
    <svg
      className="paper-graph"
      viewBox={`${minX} ${-maxY} ${width} ${height}`}
      role="img"
      aria-label="宣纸师承图"
    >
      <rect x={minX} y={-maxY} width={width} height={height} fill="#f3ebd9" />
      {edges.map((edge) => {
        const from = lookup.get(edge.from);
        const to = lookup.get(edge.to);
        if (!from || !to) return null;
        const active = pathIds.includes(edge.from) && pathIds.includes(edge.to);
        return (
          <line
            key={edge.id}
            x1={from.x}
            y1={-from.y}
            x2={to.x}
            y2={-to.y}
            stroke={edge.disputed ? '#8b1e1e' : active ? '#1a1a1a' : '#6b6b6b'}
            strokeWidth={active ? 0.08 : 0.04}
            strokeDasharray={edge.disputed ? '0.16 0.1' : undefined}
            opacity={active ? 0.8 : 0.35}
          />
        );
      })}
      {shown.map((node) => {
        const selected = node.person.id === selectedId;
        const onPath = pathIds.includes(node.person.id);
        return (
          <g
            key={node.person.id}
            transform={`translate(${node.x} ${-node.y})`}
            onClick={() => onSelect(node.person.id)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              r={selected ? 0.28 : 0.16}
              fill={selected || onPath ? '#8b1e1e' : '#2c2c2c'}
            />
            <text
              x={0.28}
              y={0.1}
              fontSize={0.42}
              fill={selected ? '#8b1e1e' : '#2c2c2c'}
              fontFamily="Noto Serif SC, serif"
            >
              {node.person.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
