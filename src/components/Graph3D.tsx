import { Html, Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Edge, GraphNode } from '../types';
import { layoutGraph, nodeMap } from '../lib/layout';
import { edges, people } from '../lib/catalog';

const INK = '#2c2c2c';
const INK_FAINT = '#6b6b6b';
const SEAL = '#8b1e1e';

interface Graph3DProps {
  selectedId: string | null;
  pathIds: string[];
  visibleIds: Set<string> | null;
  onSelect: (id: string) => void;
}

export function Graph3D(props: Graph3DProps) {
  const nodes = useMemo(() => layoutGraph(people, edges), []);
  return (
    <Canvas
      className="graph-canvas"
      camera={{ position: [6, 3.2, 18], fov: 42, near: 0.1, far: 120 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      onPointerMissed={() => undefined}
    >
      <color attach="background" args={['#f3ebd9']} />
      <fog attach="fog" args={['#f3ebd9', 16, 48]} />
      <ambientLight intensity={0.72} color="#f4efe2" />
      <directionalLight position={[8, 12, 6]} intensity={0.55} color="#fff6e6" />
      <directionalLight position={[-6, 4, -8]} intensity={0.18} color="#c9b89a" />
      <LineageScene nodes={nodes} {...props} />
    </Canvas>
  );
}

function LineageScene({
  nodes,
  selectedId,
  pathIds,
  visibleIds,
  onSelect,
}: Graph3DProps & { nodes: GraphNode[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const lookup = useMemo(() => nodeMap(nodes), [nodes]);
  const visibleEdges = useMemo(
    () =>
      edges.filter((edge) => {
        if (!lookup.has(edge.from) || !lookup.has(edge.to)) return false;
        if (!visibleIds) return true;
        return visibleIds.has(edge.from) && visibleIds.has(edge.to);
      }),
    [lookup, visibleIds],
  );

  return (
    <>
      <FlyTo nodes={lookup} selectedId={selectedId} />
      {visibleEdges.map((edge) => (
        <MentorLine
          key={edge.id}
          edge={edge}
          from={lookup.get(edge.from)!}
          to={lookup.get(edge.to)!}
          active={pathIds.includes(edge.from) && pathIds.includes(edge.to)}
        />
      ))}
      {nodes.map((node) => {
        if (visibleIds && !visibleIds.has(node.person.id)) return null;
        return (
          <PersonNode
            key={node.person.id}
            node={node}
            selected={selectedId === node.person.id}
            onPath={pathIds.includes(node.person.id)}
            showLabel={
              selectedId === node.person.id ||
              pathIds.includes(node.person.id) ||
              hovered === node.person.id
            }
            onHover={setHovered}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
}

function MentorLine({
  edge,
  from,
  to,
  active,
}: {
  edge: Edge;
  from: GraphNode;
  to: GraphNode;
  active: boolean;
}) {
  const points = useMemo(
    () => [new Vector3(from.x, from.y, from.z), new Vector3(to.x, to.y, to.z)],
    [from, to],
  );
  const color = edge.disputed ? SEAL : active ? INK : INK_FAINT;
  return (
    <Line
      points={points}
      color={color}
      transparent
      opacity={active ? 0.78 : edge.disputed ? 0.32 : 0.28}
      lineWidth={active ? 1.8 : 1}
      dashed={Boolean(edge.disputed)}
      dashSize={0.18}
      gapSize={0.12}
    />
  );
}

function PersonNode({
  node,
  selected,
  onPath,
  showLabel,
  onHover,
  onSelect,
}: {
  node: GraphNode;
  selected: boolean;
  onPath: boolean;
  showLabel: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const color = selected || onPath ? SEAL : INK;
  const radius = selected ? 0.28 : onPath ? 0.2 : 0.14;
  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node.person.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          onHover(node.person.id);
        }}
        onPointerOut={() => onHover(null)}
      >
        <sphereGeometry args={[radius, 18, 18]} />
        <meshStandardMaterial color={color} roughness={0.92} metalness={0.02} />
      </mesh>
      {selected ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.42, 0.018, 8, 32]} />
          <meshStandardMaterial color={SEAL} roughness={1} />
        </mesh>
      ) : null}
      {showLabel ? (
        <Html center distanceFactor={18} style={{ pointerEvents: 'none' }}>
          <div className={`node-label ${selected ? 'is-selected' : ''} ${onPath ? 'is-path' : ''}`}>
            {node.person.name}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

function FlyTo({
  nodes,
  selectedId,
}: {
  nodes: Map<string, GraphNode>;
  selectedId: string | null;
}) {
  const { camera } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useRef(new Vector3(6, 3.2, 18));
  const look = useRef(new Vector3(0, 0, 0));

  useEffect(() => {
    if (!selectedId) {
      goal.current.set(6, 3.2, 18);
      look.current.set(0, 0, 0);
      return;
    }
    const node = nodes.get(selectedId);
    if (!node) return;
    goal.current.set(node.x + 2.4, node.y + 1.4, node.z + 6.8);
    look.current.set(node.x, node.y, node.z);
  }, [nodes, selectedId]);

  useFrame((_, delta) => {
    const t = 1 - Math.pow(0.12, delta * 60);
    camera.position.lerp(goal.current, t);
    if (controls.current) {
      controls.current.target.lerp(look.current, t);
      controls.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan
      enableDamping
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={42}
    />
  );
}
