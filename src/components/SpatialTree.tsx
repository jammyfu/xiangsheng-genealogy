import { treeLabelStyle } from "../lib/tree-label-style";
import { lineageComparison } from "../lib/lineage-focus";
import { gsap } from "gsap";
import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import ForceGraph3D from '3d-force-graph';
import type { ForceGraph3DInstance } from '3d-force-graph';
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, SphereGeometry, Sprite, SpriteMaterial, Vector3, PerspectiveCamera, SRGBColorSpace, RingGeometry, DoubleSide } from 'three';
import type { AtlasLayout, AtlasViewport } from '../lib/atlas';
import { forceTreeData, forceLinkColor } from '../lib/force-tree';
import type { ForcePerson, ForceRelation } from '../lib/force-tree';
import './spatial-tree.css';
export interface SpatialTreeControls { zoom(factor: number): void; fit(): void; focus(): void; }
interface Props {
  graph: AtlasLayout; viewport: AtlasViewport; selectedId: string; active: boolean;
  onSelect(id: string): void; onBranch(id: string): void; onFailure(): void;
  controlsRef: MutableRefObject<SpatialTreeControls | null>;
}
type ForceView = ForceGraph3DInstance<ForcePerson, ForceRelation>;
export default function SpatialTree(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<ForceView | null>(null);
  const latest = useRef(props); latest.current = props;
  const cache = useRef(new Map<string, ForcePerson>());
  const [inspected, setInspected] = useState(props.selectedId);
  const [ready, setReady] = useState(false);
  const previousCount = useRef(props.graph.nodes.length);
  const needsFit = useRef(true);
  const reduced = useRef(false);
  const hovered = useRef<string | null>(null);
  const comparisonLinks = useRef(new Set<string>());
  const comparisonNodes = useRef(new Set<string>());
  const sharedNodes = useRef(new Set<string>());
  const compareRef = useRef<(id: string | null) => void>(() => {});
  const [comparison, setComparison] = useState<{name: string; shared: number} | null>(null);
  const fit = (duration = 750, lineageId?: string) => {
    const api = instance.current;
    if (!api) return;
    const focusNodes = lineageId ? lineageComparison(lineageId, null, latest.current.graph.edges).selected.nodes : null;
    const nodes = latest.current.graph.nodes.filter(n => !focusNodes || focusNodes.has(n.person.id)).map(n => cache.current.get(n.person.id)).filter((n): n is ForcePerson => Boolean(n));
    if (!nodes.length) return;
    const extent = (axis: "x" | "y" | "z") => {
      const values = nodes.map(n => n[axis] ?? 0);
      return [Math.min(...values), Math.max(...values)];
    };
    const [x0,x1] = extent("x"), [y0,y1] = extent("y"), [z0,z1] = extent("z");
    const target = new Vector3((x0+x1)/2, (y0+y1)/2 - 15, (z0+z1)/2);
    const camera = api.camera() as PerspectiveCamera;
    const tangent = Math.tan(camera.fov * Math.PI / 360);
    const distance = Math.max((y1-y0+140)/(2*tangent), (x1-x0+130)/(2*tangent*camera.aspect), 230) + (z1-z0)/2;
    api.cameraPosition(target.clone().add(new Vector3(distance*.28, distance*.20, distance*1.08)), target, reduced.current ? 0 : duration);
  };
  const focus = (id: string) => {
    const api = instance.current, node = cache.current.get(id);
    if (!api || !node) return;
    const target = new Vector3(node.x ?? 0, node.y ?? 0, node.z ?? 0);
    const direction = new Vector3().copy(api.cameraPosition()).sub(target).normalize();
    if (!direction.lengthSq()) direction.set(0, 0, 1);
    api.cameraPosition(target.clone().addScaledVector(direction, 360), target, reduced.current ? 0 : 850);
  };
  const activate = (id: string) => {
    const node = latest.current.graph.nodes.find(n => n.person.id === id);
    setInspected(id);
    focus(id);
    if (node?.childCount) latest.current.onBranch(id);
    else latest.current.onSelect(id);
  };
  useEffect(() => {
    if (!host.current) return;
    const resources: Array<{ dispose(): void }> = [];
    const objectCache = new Map<string, { key: string; group: Group; dot: MeshBasicMaterial; label: SpriteMaterial; labelSprite: Sprite; halo: Mesh }>();
    const labelTextures = new Map<string, CanvasTexture>();
    const labelStyle = (node: ForcePerson) => treeLabelStyle({ selected: node.atlas.selected, related: node.related, compared: comparisonNodes.current.has(node.id), shared: sharedNodes.current.has(node.id) });
    const labelTexture = (node: ForcePerson) => {
      const style = labelStyle(node), name = node.atlas.person.name;
      const key = `${node.id}:${style.mode}`;
      const cached = labelTextures.get(key);
      if (cached) return cached;
      const canvas = document.createElement('canvas');
      canvas.width = 96; canvas.height = [...name].length * 64 + 16;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = style.paper; ctx.fillRect(3, 1, 90, canvas.height-2);
      ctx.strokeStyle = style.border; ctx.lineWidth = style.mode === 'selected' ? 3 : 1.5;
      ctx.strokeRect(3, 1, 90, canvas.height-2);
      ctx.font = style.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = style.ink;
      [...name].forEach((glyph, i) => ctx.fillText(glyph,48,i*64+40));
      const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
      labelTextures.set(key,texture); resources.push(texture);
      return texture;
    };
    let cancelled = false;
    try {
      reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const api = new ForceGraph3D(host.current, { controlType: 'orbit' }) as unknown as ForceView;
      instance.current = api;
      api.width(latest.current.viewport.width).height(latest.current.viewport.height)
        .backgroundColor('#f8f5ee').showNavInfo(false)
        .nodeThreeObject((node) => {
          const n = node.atlas;
          const color = n.selected ? '#8b2626' : node.related ? '#534837' : '#6a786e';
          const key = `${color}:${n.dimmed}:${node.related}`;
          const old = objectCache.get(node.id);
          if (old?.key === key) return old.group;
          const group = new Group();
          const geometry = new SphereGeometry(n.selected ? 8 : 3.2, 20, 16);
          const material = new MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: node.related ? 1 : .18 });
          group.add(new Mesh(geometry, material));
          if (n.selected) {
            for (const [inner, outer, color] of [[11, 12.2, '#8b2626'], [15, 15.7, '#ba9251']] as const) {
              const ringGeometry = new RingGeometry(inner, outer, 64);
              const ringMaterial = new MeshBasicMaterial({ color, side: DoubleSide, toneMapped: false, depthWrite: false });
              const ring = new Mesh(ringGeometry, ringMaterial);
              ring.name = 'selected-person-halo'; group.add(ring);
              resources.push(ringGeometry, ringMaterial);
            }
          }
          const texture = labelTexture(node);
          const labelMaterial = new SpriteMaterial({ map: texture, toneMapped: false, transparent: true, depthWrite: false, depthTest: false, opacity: 1 });
          const label = new Sprite(labelMaterial);
          const width = labelStyle(node).width;
          const height = ([...n.person.name].length * 64 + 16) * width / 96;
          label.scale.set(width, height, 1); label.position.set(0, -height / 2 - (n.selected ? 20 : 7), 0);
          label.renderOrder = n.selected ? 30 : 25;
          group.add(label);
          resources.push(geometry, material, labelMaterial);
          const hoverGeometry = new RingGeometry(6, 7, 48);
          const hoverMaterial = new MeshBasicMaterial({ color: '#197c85', side: DoubleSide, toneMapped: false, depthWrite: false });
          const hoverHalo = new Mesh(hoverGeometry, hoverMaterial); hoverHalo.visible = false;
          group.add(hoverHalo); resources.push(hoverGeometry, hoverMaterial);
          objectCache.set(node.id, { key, group, dot: material, label: labelMaterial, labelSprite: label, halo: hoverHalo });
          return group;
        })
        .nodeLabel(n => `${n.atlas.person.name} · ${n.atlas.hiddenChildren ? `点击展开 ${n.atlas.hiddenChildren} 位传人` : n.atlas.childCount ? '点击收起传人' : '查看人物'}`)
        .linkColor(e => forceLinkColor(e, comparisonLinks.current))
        .linkOpacity(1).linkWidth(e => e.highlighted ? 2.2 : comparisonLinks.current.has(e.id) ? 1.8 : .35)
        .linkDirectionalArrowLength(e => e.highlighted || comparisonLinks.current.has(e.id) ? 5 : 1.5).linkDirectionalArrowRelPos(.85)
        .linkDirectionalParticles(e => !reduced.current && (e.highlighted || comparisonLinks.current.has(e.id)) ? 2 : 0)
        .linkDirectionalParticleWidth(1.6).linkDirectionalParticleSpeed(.003)
        .linkLabel(e => e.disputed ? '师承存在不同说法，出处见人物书笺' : '师父 → 徒弟')
        .enableNodeDrag(false).warmupTicks(50).cooldownTicks(reduced.current ? 0 : 100)
        .onEngineStop(() => { if (needsFit.current) { needsFit.current = false; fit(700, latest.current.selectedId); } })
        .onNodeClick(n => activate(n.id))
        .onNodeHover(n => compareRef.current(n?.id ?? null));
      compareRef.current = (id) => {
        if (hovered.current === id) return;
        hovered.current = id;
        const paths = lineageComparison(latest.current.selectedId, id, latest.current.graph.edges);
        comparisonLinks.current = paths.compared.links;
        comparisonNodes.current = paths.compared.nodes; sharedNodes.current = paths.sharedNodes;
        const person = id && cache.current.get(id);
        setComparison(person && id !== latest.current.selectedId ? { name: person.atlas.person.name, shared: paths.sharedNodes.size } : null);
        for (const [nodeId, visual] of objectCache) {
          const node = cache.current.get(nodeId);
          if (!node) continue;
          const comparing = paths.compared.nodes.has(nodeId), shared = paths.sharedNodes.has(nodeId);
          const prominent = node.related || comparing;
          const scale = nodeId === id ? (node.atlas.selected ? 1.08 : 1.35) : comparing && !node.related ? 1.15 : 1;
          gsap.killTweensOf(visual.group.scale);
          gsap.to(visual.group.scale, { x: scale, y: scale, z: scale, duration: reduced.current ? 0 : .28 });
          gsap.killTweensOf(visual.dot);
          gsap.to(visual.dot, { opacity: prominent ? 1 : .18, duration: reduced.current ? 0 : .24 });
          visual.label.opacity = 1;
          visual.label.map = labelTexture(node); visual.label.needsUpdate = true;
          const style = labelStyle(node), height = ([...node.atlas.person.name].length*64+16)*style.width/96;
          visual.labelSprite.scale.set(style.width,height,1);
          visual.labelSprite.position.y = -height/2-(node.atlas.selected ? 20 : 7);
          visual.dot.color.set(node.atlas.selected ? '#8b2626' : shared ? '#77549c' : comparing ? '#197c85' : node.related ? '#534837' : '#6a786e');
          visual.halo.visible = nodeId === id && !node.atlas.selected;
        }
        api.linkColor(api.linkColor()).linkWidth(api.linkWidth())
          .linkDirectionalArrowLength(api.linkDirectionalArrowLength())
          .linkDirectionalParticles(api.linkDirectionalParticles());
        if (host.current) host.current.style.cursor = id ? 'pointer' : 'grab';
      };
      const charge = api.d3Force('charge') as { strength?(n: number): void } | undefined;
      charge?.strength?.(-260);
      api.d3Force('lineage-depth', (alpha: number) => {
        for (const n of api.graphData().nodes) n.vz = (n.vz ?? 0) + (n.depthTarget - (n.z ?? 0)) * .16 * alpha;
      });
      api.graphData(forceTreeData(latest.current.graph, cache.current));
      fit(0, latest.current.selectedId);
      latest.current.controlsRef.current = {
        fit: () => fit(),
        focus: () => fit(750, latest.current.selectedId),
        zoom: factor => {
          const target = (api.controls() as { target: Vector3 }).target;
          const pos = new Vector3().copy(api.cameraPosition()).sub(target).multiplyScalar(1 / factor).add(target);
          api.cameraPosition(pos, target, reduced.current ? 0 : 220);
        },
      };
      Promise.all([document.fonts.load('52px "Ma Shan Zheng"'), document.fonts.load('600 48px "Noto Serif SC"')]).then(() => {
        if (cancelled) return;
        labelTextures.clear(); objectCache.clear(); api.nodeThreeObject(api.nodeThreeObject());
      });
      if (!latest.current.active) api.pauseAnimation();
      setReady(true);
    } catch { latest.current.onFailure(); }
    return () => {
      cancelled = true;
      latest.current.controlsRef.current = null;
      instance.current?._destructor(); instance.current = null;
      compareRef.current = () => {};
      objectCache.forEach(({ group, dot, label }) => { gsap.killTweensOf(group.scale); gsap.killTweensOf(dot); gsap.killTweensOf(label); });
      resources.forEach(r => r.dispose());
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    compareRef.current(null);
    instance.current?.graphData(forceTreeData(props.graph, cache.current));
    if (props.graph.nodes.length > previousCount.current * 2) needsFit.current = true;
    previousCount.current = props.graph.nodes.length;
  }, [props.graph, ready]);
  useEffect(() => { instance.current?.width(props.viewport.width).height(props.viewport.height); }, [props.viewport]);
  useEffect(() => { props.active ? instance.current?.resumeAnimation() : instance.current?.pauseAnimation(); }, [props.active, ready]);
  useEffect(() => { setInspected(props.selectedId); if (ready) fit(750, props.selectedId); }, [props.selectedId]);
  const node = props.graph.nodes.find(n => n.person.id === inspected) ?? props.graph.nodes.find(n => n.selected);
  return <div className="force-tree" aria-label="可展开的三维世代谱系">
    <div ref={host} className="force-tree-canvas" onPointerLeave={() => compareRef.current(null)} />
    <div className="force-comparison" role="status" aria-live="polite">
      <span className="force-path-current">当前：{props.graph.nodes.find(n => n.selected)?.person.name}</span>
      {comparison ? <><span className="force-path-hover">对照：{comparison.name}</span><span className="force-path-shared">共同路径 · {comparison.shared} 人</span></> : <small>移到其他人物，对照完整师承</small>}
    </div>
    {node && <div className="force-tree-actions" data-atlas-control="force">
      <strong>{node.person.name}</strong>{node.selected && <span className="force-current-label">当前人物</span>}
      {node.childCount > 0 && <button onClick={() => activate(node.person.id)}>{node.hiddenChildren ? `展开传人 · ${node.hiddenChildren}` : '收起传人'}</button>}
      <button onClick={() => props.onSelect(node.person.id)}>查看人物</button>
    </div>}
    <details className="force-tree-directory" data-atlas-control="force">
      <summary>人物与支系 · {props.graph.nodes.length}</summary>
      <div>{props.graph.nodes.map(n => <button key={n.person.id} onPointerEnter={() => compareRef.current(n.person.id)} onPointerLeave={() => compareRef.current(null)} onFocus={() => compareRef.current(n.person.id)} onBlur={() => compareRef.current(null)} aria-label={`${n.person.name}，${n.childCount ? n.hiddenChildren ? '展开传人' : '收起传人' : '查看人物'}`} onClick={() => activate(n.person.id)}>{n.person.name}<small>{n.childCount ? n.hiddenChildren ? `＋${n.hiddenChildren}` : '－' : ''}</small></button>)}</div>
    </details>
  </div>;
}
