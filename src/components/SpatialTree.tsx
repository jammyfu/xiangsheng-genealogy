import { disciplesOf, mentorsOf, people, edges } from "../lib/catalog";
import { type TreeLabelCandidate, type TreeLabelPlacement } from "../lib/tree-label-layout";
import { layoutNameCloudLabels } from "../lib/name-cloud-labels";
import { nameNebulaGraph, nameNebulaPositions, positionNameNebula } from "../lib/name-nebula";
import { buildAtlas } from "../lib/atlas";
import { treeLabelStyle } from "../lib/tree-label-style";
import { lineageComparison } from "../lib/lineage-focus";
import { gsap } from "gsap";
import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import ForceGraph3D from '3d-force-graph';
import type { ForceGraph3DInstance } from '3d-force-graph';
import { AdditiveBlending, CanvasTexture, Group, Mesh, MeshBasicMaterial, SphereGeometry, Sprite, SpriteMaterial, Vector3, PerspectiveCamera, SRGBColorSpace, RingGeometry, DoubleSide, Line, BufferGeometry, LineBasicMaterial } from 'three';
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
  const gesture = useRef({x:0,y:0,moved:false,labelHit:false});
  const nameHits = useRef<TreeLabelPlacement[]>([]);
  const labelStats = useRef<HTMLSpanElement>(null);
  const directory = useRef<HTMLDetailsElement>(null);
  const [directoryMode, setDirectoryMode] = useState<"mentors" | "disciples" | "graph">("mentors");
  const [directoryQuery, setDirectoryQuery] = useState("");
  const instance = useRef<ForceView | null>(null);
  const catalog = useRef(buildAtlas({people,edges,selectedId:props.selectedId,mode:"tree",showAll:true}));
  const cloudPositions = useRef(nameNebulaPositions(people,edges));
  const visualData = (graph:AtlasLayout) => {
    const data = forceTreeData(nameNebulaGraph(graph,catalog.current),cache.current);
    positionNameNebula(data.nodes,cloudPositions.current);
    return data;
  };
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
    if (focusNodes && lineageId) for (const edge of latest.current.graph.edges) if (edge.from === lineageId) focusNodes.add(edge.to);
    const nodes = [...cache.current.values()].filter(n => !focusNodes || focusNodes.has(n.id));
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
    setInspected(id);
    if (directory.current?.open) { directory.current.open = false; directory.current.querySelector("summary")?.focus(); }
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
    const objectCache = new Map<string, { leader: Line; key: string; group: Group; dot: MeshBasicMaterial; label: SpriteMaterial; labelSprite: Sprite; halo: Mesh }>();
    const labelTextures = new Map<string, CanvasTexture>();
    const labelStyle = (node: ForcePerson) => treeLabelStyle({ selected: node.atlas.selected, related: node.related, compared: comparisonNodes.current.has(node.id), shared: sharedNodes.current.has(node.id) });
    const labelTexture = (node: ForcePerson) => {
      const style = labelStyle(node), name = node.atlas.person.name;
      const key = `${node.id}:${style.mode}`;
      const cached = labelTextures.get(key);
      if (cached) return cached;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(96, [...name].length * 38 + 24); canvas.height = 48;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.shadowColor="#080c15"; ctx.shadowBlur=5;
      ctx.font = style.font.replace(/\d+px/, "32px"); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = style.ink;
      ctx.fillText(name, canvas.width/2, 24);
      const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
      labelTextures.set(key,texture); resources.push(texture);
      return texture;
    };
    let cancelled = false;
    let labelFrame = 0;
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
          const geometry = new SphereGeometry(n.selected ? 3 : .65, 12, 8);
          const material = new MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: node.related ? 1 : .18 });
          group.add(new Mesh(geometry, material));
          const glowMaterial = new SpriteMaterial({ map: glowTexture, color, transparent: true, opacity: n.selected ? .8 : node.related ? .48 : .16, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
          const glow = new Sprite(glowMaterial);
          const glowSize = n.selected ? 18 : node.related ? 5 : 0;
          glow.scale.setScalar(glowSize); glow.raycast = () => {}; group.add(glow); resources.push(glowMaterial);

          if (n.selected) {
            for (const [inner, outer, color] of [[11, 12.2, '#ff927f'], [15, 15.7, '#e6c98c']] as const) {
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
          const hoverMaterial = new MeshBasicMaterial({ color: '#75dce3', side: DoubleSide, toneMapped: false, depthWrite: false });
          const hoverHalo = new Mesh(hoverGeometry, hoverMaterial); hoverHalo.visible = false;
          group.add(hoverHalo); resources.push(hoverGeometry, hoverMaterial);
          const leaderGeometry = new BufferGeometry().setFromPoints([new Vector3(),new Vector3()]);
          const leaderMaterial = new LineBasicMaterial({color,transparent:true,opacity:node.related ? .6 : .2,depthTest:false});
          const leader = new Line(leaderGeometry,leaderMaterial); leader.raycast = () => {}; group.add(leader);
          resources.push(leaderGeometry,leaderMaterial);
          objectCache.set(node.id, { leader, key, group, dot: material, label: labelMaterial, labelSprite: label, halo: hoverHalo });
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
        .onEngineStop(() => { if (needsFit.current) { needsFit.current = false; fit(700); } })
        .onNodeClick(n => { if (!gesture.current.moved && !gesture.current.labelHit) activate(n.id); })
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

          gsap.killTweensOf(visual.dot);
          gsap.to(visual.dot, { opacity: prominent ? 1 : .18, duration: reduced.current ? 0 : .24 });
          visual.label.opacity = 1;
          visual.label.map = labelTexture(node); visual.label.needsUpdate = true;

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
      // Centering hundreds of fixed context names otherwise pushes the free lineage out of view.
      api.d3Force('center', null);
      api.d3Force('lineage-depth', (alpha: number) => {
        for (const n of api.graphData().nodes) n.vz = (n.vz ?? 0) + (n.depthTarget - (n.z ?? 0)) * .16 * alpha;
      });
      api.graphData(visualData(latest.current.graph));
      fit(0);
      let lastLayout = 0;
      let previousPose = "";
      let previousGraph: AtlasLayout | null = null;
      const layoutLabels = (time: number) => {
        if (cancelled) return;
        labelFrame = requestAnimationFrame(layoutLabels);
        if (!latest.current.active || time - lastLayout < 16) return;
        lastLayout = time;
        const camera = api.camera() as PerspectiveCamera;
        camera.updateMatrixWorld();
        const positionSignature = api.graphData().nodes.reduce((sum,n)=>sum+(n.x??0)*.17+(n.y??0)*.31+(n.z??0)*.53,0);
        const scaleSignature = [...objectCache.values()].reduce((sum,v)=>sum+v.group.scale.x,0);
        const pose = `${camera.matrixWorld.elements.join(',')}:${positionSignature}:${scaleSignature}:${objectCache.size}:${hovered.current}:${directory.current?.open}:${latest.current.viewport.width}:${latest.current.viewport.height}`;
        if (pose===previousPose && latest.current.graph===previousGraph) return;
        previousPose=pose; previousGraph=latest.current.graph;
        api.scene().updateMatrixWorld();
        const { width, height } = latest.current.viewport;
        const candidates: TreeLabelCandidate[] = [];
        const direct = new Set(latest.current.graph.edges.filter(e=>e.from===latest.current.selectedId).map(e=>e.to));
        for (const [id, visual] of objectCache) {
          const node = cache.current.get(id);
          if (!node) continue;
          const world = visual.group.getWorldPosition(new Vector3());
          const view = world.clone().applyMatrix4(camera.matrixWorldInverse);
          const screen = world.clone().project(camera);
          const main = node.related;
          const viewDepth = Math.max(1,-view.z);
          const contextSize = Math.min(15,Math.max(3,8*height/(2*viewDepth*Math.tan(camera.fov*Math.PI/360))));
          const fontSize = node.atlas.selected ? 22 : main ? 14 : contextSize;
          const pixelWidth = [...node.atlas.person.name].length*fontSize+(main?8:3);
          const pixelHeight = fontSize+(main?7:3);
          visual.labelSprite.visible = false; visual.leader.visible = false;
          if (view.z >= 0 || screen.z < -1 || screen.z > 1 || (!node.atlas.selected && (Math.abs(screen.x)>1 || Math.abs(screen.y)>1))) continue;
          candidates.push({ id, x:(screen.x + 1) * width / 2 - pixelWidth / 2, y:(1 - screen.y) * height / 2 - pixelHeight/2,
            width:pixelWidth, height:pixelHeight, priority:node.atlas.selected ? 100 : direct.has(id) ? 40 : node.related ? 20 : 1 });
        }
        const rect = host.current?.getBoundingClientRect();
        const obstacles = rect ? [...(host.current!.closest('.atlas-graph') ?? host.current!.parentElement!).querySelectorAll<HTMLElement>('[data-atlas-control], .force-comparison, .force-tree-cosmic-caption, .atlas-topline, .atlas-bottomline')].filter(element=>element.offsetHeight && getComputedStyle(element).visibility!=='hidden').map(element=>{const r=element.getBoundingClientRect();return {x:r.left-rect.left-4,y:r.top-rect.top-4,width:r.width+8,height:r.height+8};}) : [];
        const focused = candidates.filter(label=>label.priority>1);
        obstacles.push({x:0,y:height-64,width,height:64});
        const placed = layoutNameCloudLabels(candidates,width,height,obstacles);
        nameHits.current = placed;
        for (const label of placed) {
          const visual = objectCache.get(label.id)!, node = cache.current.get(label.id)!;
          const anchor = visual.group.getWorldPosition(new Vector3());
          const depth = anchor.clone().project(camera).z;
          const center = new Vector3((label.x+label.width/2)/width*2-1,1-(label.y+label.height/2)/height*2,depth).unproject(camera);
          const local = visual.group.worldToLocal(center.clone());
          const viewDepth = -center.clone().applyMatrix4(camera.matrixWorldInverse).z;
          const unit = 2 * viewDepth * Math.tan(camera.fov * Math.PI / 360) / height / (visual.group.scale.x||1);
          visual.labelSprite.position.copy(local); visual.labelSprite.scale.set(label.width*unit,label.height*unit,1); visual.labelSprite.visible = true;
          visual.label.opacity = node.atlas.dimmed ? .2 : label.priority>1 ? 1 : .82;
          const positions = visual.leader.geometry.attributes.position;
          positions.setXYZ(0,0,0,0); positions.setXYZ(1,local.x,local.y,local.z); positions.needsUpdate=true;
          visual.leader.geometry.computeBoundingSphere(); visual.leader.visible=label.priority>1 && Math.hypot(label.x+label.width/2-label.anchorX,label.y+label.height/2-label.anchorY)>12;
          (visual.leader.material as LineBasicMaterial).color.set(node.atlas.selected ? '#ff927f' : node.related ? '#e8c17c' : '#52627c');
        }
        if (labelStats.current) labelStats.current.textContent = `主线姓名 ${placed.filter(label=>label.priority>1).length}/${focused.length} · 字云 ${placed.length}/${cache.current.size} 人 · 放大读姓名`;
      };
      labelFrame = requestAnimationFrame(layoutLabels);
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
        labelTextures.clear();
        for (const [id,visual] of objectCache) {
          const node=cache.current.get(id);
          if (node) { visual.label.map=labelTexture(node); visual.label.needsUpdate=true; }
        }
      });
      if (!latest.current.active) api.pauseAnimation();
      setReady(true);
    } catch { latest.current.onFailure(); }
    return () => {
      cancelled = true;
      cancelAnimationFrame(labelFrame);
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
    instance.current?.graphData(visualData(props.graph));
    if (props.graph.nodes.length > previousCount.current * 2) needsFit.current = true;
    previousCount.current = props.graph.nodes.length;
  }, [props.graph, ready]);
  useEffect(() => { instance.current?.width(props.viewport.width).height(props.viewport.height); if (ready) fit(0); }, [props.viewport, ready]);
  useEffect(() => { props.active ? instance.current?.resumeAnimation() : instance.current?.pauseAnimation(); }, [props.active, ready]);
  useEffect(() => {
    setInspected(props.selectedId);
    setDirectoryQuery("");
    if (ready) { needsFit.current = true; fit(750); }
  }, [props.selectedId, ready]);
  const node = props.graph.nodes.find(n => n.person.id === inspected) ?? props.graph.nodes.find(n => n.selected);
  const mentors = mentorsOf(props.selectedId), disciples = disciplesOf(props.selectedId);
  const directoryPeople = directoryMode === "mentors" ? mentors : directoryMode === "disciples" ? disciples : people;
  const query = directoryQuery.trim().toLocaleLowerCase();
  const matches = directoryPeople.filter(p => [p.name, p.nameHant, ...(p.aliases ?? [])].some(name => name?.toLocaleLowerCase().includes(query)));
  return <div className="force-tree" aria-label="可展开的三维世代谱系">
    <div ref={host} className="force-tree-canvas" onPointerDown={event=>{gesture.current={x:event.clientX,y:event.clientY,moved:false,labelHit:false};}} onPointerMove={event => {
      if (event.buttons && Math.hypot(event.clientX-gesture.current.x,event.clientY-gesture.current.y)>5) gesture.current.moved=true;

    }} onPointerUp={event=>{
      if (gesture.current.moved) return;
      const rect=event.currentTarget.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      const name=nameHits.current.find(n=>x>=n.x && x<=n.x+n.width && y>=n.y && y<=n.y+n.height);
      if(name) { gesture.current.labelHit=true; activate(name.id); }
    }} onPointerLeave={() => { compareRef.current(null); }} />
    <div className="force-tree-cosmic-caption" aria-hidden="true"><span>姓名成云</span><small>远观支脉 · 近读其名</small></div>
    <div className="force-comparison" role="status" aria-live="polite">
      <span className="force-path-current">当前：{props.graph.nodes.find(n => n.selected)?.person.name}</span>
      {comparison ? <><span className="force-path-hover">对照：{comparison.name}</span><span className="force-path-shared">共同路径 · {comparison.shared} 人</span></> : <small>拖动旋转 · 滚轮缩放 · 点姓名查看师承</small>}
    <span ref={labelStats} className="force-label-stats" />
    </div>
    {node && <div className="force-tree-actions" data-atlas-control="force">
      <strong>{node.person.name}</strong>{node.selected && <span className="force-current-label">当前人物</span>}
      {node.childCount > 0 && <button onClick={() => { needsFit.current = true; props.onBranch(node.person.id); }}>{node.hiddenChildren ? `展开传人 · ${node.hiddenChildren}` : '收起传人'}</button>}
      <button onClick={() => props.onSelect(node.person.id)}>查看人物</button>
    </div>}
    <details ref={directory} className="force-tree-directory" data-atlas-control="force" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); directory.current!.open = false; directory.current?.querySelector("summary")?.focus(); } }}>
      <summary>师父与弟子 · {mentors.length} / {disciples.length}</summary>
      <div className="force-directory-content">
        <strong>{node?.person.name}的师承导航</strong>
        <div className="force-directory-modes" role="group" aria-label="师承导航范围">
          {([["mentors", `师父 · ${mentors.length}`], ["disciples", `弟子 · ${disciples.length}`], ["graph", `图中人物 · ${people.length}`]] as const).map(([mode, label]) => <button key={mode} aria-pressed={directoryMode === mode} onClick={() => { setDirectoryMode(mode); setDirectoryQuery(""); }}>{label}</button>)}
        </div>
        <input aria-label="检索师承导航" placeholder="输入姓名或艺名" value={directoryQuery} onChange={event => setDirectoryQuery(event.target.value)} />
        <p role="status">{query ? `找到 ${matches.length} / ${directoryPeople.length} 人` : directoryMode === "graph" ? "图中姓名自动避让；完整名单可在此选择" : "直接师承关系 · 点击姓名定位人物"}</p>
        <div className="force-directory-list">{matches.map(person => <button key={person.id} onPointerEnter={() => compareRef.current(person.id)} onPointerLeave={() => compareRef.current(null)} onFocus={() => compareRef.current(person.id)} onBlur={() => compareRef.current(null)} aria-label={`${person.name}，查看师承主线`} onClick={() => activate(person.id)}>{person.name}</button>)}</div>
        {!matches.length && <p>{query ? "没有匹配人物，请更换姓名或艺名。" : directoryMode === "mentors" ? "尚未记录师父。" : "尚未记录弟子。"}</p>}
      </div>
    </details>
  </div>;
}
