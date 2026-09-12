import { treeLabelStyle } from "../lib/tree-label-style";
import { createGenealogyStars } from '../lib/genealogy-stars';
import { lineageComparison } from "../lib/lineage-focus";
import { gsap } from "gsap";
import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import ForceGraph3D from '3d-force-graph';
import type { ForceGraph3DInstance } from '3d-force-graph';
import { AdditiveBlending, CanvasTexture, Group, Mesh, MeshBasicMaterial, SphereGeometry, Sprite, SpriteMaterial, Vector3, PerspectiveCamera, SRGBColorSpace, RingGeometry, DoubleSide } from 'three';
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
  const stars = useRef<ReturnType<typeof createGenealogyStars> | null>(null);
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
  const activate = (id: string) => {
    const target = cache.current.get(id), api = instance.current;
    if (target && api) {
      const screen = new Vector3(target.x ?? 0, target.y ?? 0, target.z ?? 0).project(api.camera());
      stars.current?.burst(screen.x, screen.y);
    }
    setInspected(id);
    compareRef.current(null);
    if (id === latest.current.selectedId) fit(750, id);
    else latest.current.onSelect(id);
  };
  useEffect(() => {
    if (!host.current) return;
    const resources: Array<{ dispose(): void }> = [];
    const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 128;
    const glowContext = glowCanvas.getContext('2d')!;
    const gradient = glowContext.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(.12, '#ffffffc0');
    gradient.addColorStop(.35, '#ffffff35'); gradient.addColorStop(1, '#ffffff00');
    glowContext.fillStyle = gradient; glowContext.fillRect(0,0,128,128);
    const glowTexture = new CanvasTexture(glowCanvas); resources.push(glowTexture);
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
        .backgroundColor('#080c15').showNavInfo(false)
        .nodeThreeObject((node) => {
          const n = node.atlas;
          const color = n.selected ? '#ff927f' : node.related ? '#f0d6a2' : '#93acc8';
          const key = `${color}:${n.dimmed}:${node.related}`;
          const old = objectCache.get(node.id);
          if (old?.key === key) return old.group;
          const group = new Group();
          const geometry = new SphereGeometry(n.selected ? 8 : 3.2, 20, 16);
          const material = new MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: node.related ? 1 : .18 });
          group.add(new Mesh(geometry, material));
          const glowMaterial = new SpriteMaterial({ map: glowTexture, color, transparent: true, opacity: n.selected ? .8 : node.related ? .48 : .16, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
          const glow = new Sprite(glowMaterial);
          const glowSize = n.selected ? 85 : node.related ? 32 : 18;
          glow.scale.setScalar(glowSize); glow.raycast = () => {}; group.add(glow); resources.push(glowMaterial);
          if (n.selected) glow.onBeforeRender = () => { glow.scale.setScalar(glowSize * (1 + Math.sin((stars.current?.time ?? 0) * 1.4) * .07)); };
          if (n.selected) {
            for (const [inner, outer, color] of [[11, 12.2, '#ff927f'], [15, 15.7, '#e6c98c']] as const) {
              const ringGeometry = new RingGeometry(inner, outer, 64);
              const ringMaterial = new MeshBasicMaterial({ color, side: DoubleSide, toneMapped: false, depthWrite: false });
              const ring = new Mesh(ringGeometry, ringMaterial);
              ring.name = 'selected-person-halo'; group.add(ring);
              resources.push(ringGeometry, ringMaterial);
            }
            for (let orbit = 0; orbit < 2; orbit++) {
              const orbitGeometry = new RingGeometry(22 + orbit * 7, 22.5 + orbit * 7, 96, 1, orbit, Math.PI * 1.45);
              const orbitMaterial = new MeshBasicMaterial({ color: orbit ? '#80dbe5' : '#ffcc91', side: DoubleSide, transparent: true, opacity: .58, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
              const ring = new Mesh(orbitGeometry, orbitMaterial);
              ring.rotation.x = orbit ? .9 : -.65;
              ring.raycast = () => {};
              ring.onBeforeRender = () => { ring.rotation.z = (stars.current?.time ?? 0) * (orbit ? -.22 : .16); };
              group.add(ring); resources.push(orbitGeometry, orbitMaterial);
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
          const hoverMaterial = new MeshBasicMaterial({ color: '#75dce3', side: DoubleSide, toneMapped: false, depthWrite: false });
          const hoverHalo = new Mesh(hoverGeometry, hoverMaterial); hoverHalo.visible = false;
          group.add(hoverHalo); resources.push(hoverGeometry, hoverMaterial);
          objectCache.set(node.id, { key, group, dot: material, label: labelMaterial, labelSprite: label, halo: hoverHalo });
          return group;
        })
        .nodeLabel(n => `${n.atlas.person.name} · 点击查看完整师承主线`)
        .linkColor(e => {
          const color = forceLinkColor(e, comparisonLinks.current);
          return ({ '#8b2626': '#ff927f', '#a36922': '#e8c17c', '#197c85': '#75dce3', '#77549c': '#c4a5f5' } as Record<string, string>)[color] ?? 'rgba(142,170,202,0.24)';
        })
        .linkOpacity(1).linkWidth(e => e.highlighted ? 2.2 : comparisonLinks.current.has(e.id) ? 1.8 : .35)
        .linkDirectionalArrowLength(e => e.highlighted || comparisonLinks.current.has(e.id) ? 5 : 1.5).linkDirectionalArrowRelPos(.85)
        .linkDirectionalParticles(e => !reduced.current && (e.highlighted || comparisonLinks.current.has(e.id)) ? 2 : 0)
        .linkDirectionalParticleWidth(2.2).linkDirectionalParticleSpeed(.0025)
        .linkDirectionalParticleColor(e => comparisonLinks.current.has(e.id) ? '#b4fbff' : '#ffe5bf')
        .linkLabel(e => e.disputed ? '师承存在不同说法，出处见人物书笺' : '师父 → 徒弟')
        .enableNodeDrag(false).warmupTicks(50).cooldownTicks(reduced.current ? 0 : 100)
        .onEngineStop(() => { if (needsFit.current) { needsFit.current = false; fit(700, latest.current.selectedId); } })
        .onNodeClick(n => activate(n.id))
        .onNodeHover(n => compareRef.current(n?.id ?? null));
      stars.current = createGenealogyStars();
      api.scene().add(stars.current.points);
      compareRef.current = (id) => {
        if (hovered.current === id) return;
        hovered.current = id;
        stars.current?.hover(Boolean(id));
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
          visual.dot.color.set(node.atlas.selected ? '#ff927f' : shared ? '#c4a5f5' : comparing ? '#75dce3' : node.related ? '#f0d6a2' : '#93acc8');
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
      stars.current?.dispose(); stars.current = null;
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
  useEffect(() => {
    setInspected(props.selectedId);
    if (ready) { needsFit.current = true; fit(750, props.selectedId); }
  }, [props.selectedId, ready]);
  const node = props.graph.nodes.find(n => n.person.id === inspected) ?? props.graph.nodes.find(n => n.selected);
  return <div className="force-tree" aria-label="可展开的三维世代谱系">
    <div ref={host} className="force-tree-canvas" onPointerMove={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      stars.current?.move((event.clientX - rect.left) / Math.max(1, rect.width) * 2 - 1, 1 - (event.clientY - rect.top) / Math.max(1, rect.height) * 2);
    }} onPointerLeave={() => { compareRef.current(null); stars.current?.move(0, 0); }} />
    <div className="force-tree-cosmic-caption" aria-hidden="true"><span>群星相承</span><small>一人一星 · 一脉一河</small></div>
    <div className="force-comparison" role="status" aria-live="polite">
      <span className="force-path-current">当前：{props.graph.nodes.find(n => n.selected)?.person.name}</span>
      {comparison ? <><span className="force-path-hover">对照：{comparison.name}</span><span className="force-path-shared">共同路径 · {comparison.shared} 人</span></> : <small>移到其他人物，对照完整师承</small>}
    </div>
    {node && <div className="force-tree-actions" data-atlas-control="force">
      <strong>{node.person.name}</strong>{node.selected && <span className="force-current-label">当前人物</span>}
      {node.childCount > 0 && <button onClick={() => { needsFit.current = true; props.onBranch(node.person.id); }}>{node.hiddenChildren ? `展开传人 · ${node.hiddenChildren}` : '收起传人'}</button>}
      <button onClick={() => props.onSelect(node.person.id)}>查看人物</button>
    </div>}
    <details className="force-tree-directory" data-atlas-control="force">
      <summary>人物与支系 · {props.graph.nodes.length}</summary>
      <div>{props.graph.nodes.map(n => <button key={n.person.id} onPointerEnter={() => compareRef.current(n.person.id)} onPointerLeave={() => compareRef.current(null)} onFocus={() => compareRef.current(n.person.id)} onBlur={() => compareRef.current(null)} aria-label={`${n.person.name}，查看师承主线`} onClick={() => activate(n.person.id)}>{n.person.name}<small>{n.childCount ? `${n.childCount} 位传人` : ''}</small></button>)}</div>
    </details>
  </div>;
}
