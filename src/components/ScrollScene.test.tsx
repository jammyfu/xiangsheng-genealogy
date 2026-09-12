import { afterEach, describe, expect, it, vi } from "vitest";
import { create } from "@react-three/test-renderer";
import { useThree } from "@react-three/fiber";
import { Group, Line, Mesh, PerspectiveCamera, Vector3 } from "three";
import { SpatialWorld, type Motion } from "./ScrollScene";
import { buildAtlas } from "../lib/atlas";
import { buildFixedScroll } from "../lib/fixed-scroll";
import { cameraDistance, scrollPointerFromClient } from "../lib/scroll-space";
import { loadEdgesFromDisk, loadPeopleFromDisk } from "../lib/loadCatalog.node";

// These tests execute the real Three scene and frame callbacks in Node. They do
// not validate GPU output or DOM label layout; Html and the image loader are the
// only scene dependencies replaced so rendering needs no browser or network.
vi.mock("@react-three/drei", async () => {
  const { Texture } = await import("three");
  const texture = new Texture();
  return {
    Html: () => null,
    useTexture: (urls: string | string[]) =>
      Array.isArray(urls) ? urls.map(() => texture) : texture,
  };
});

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const viewport = { width: 1200, height: 700 };
const view = { x: 0, y: 0, scale: 1 };
const graph = buildAtlas({
  people: loadPeopleFromDisk(),
  edges: loadEdgesFromDisk(),
  selectedId: "hou-baolin",
  mode: "scroll",
  viewportWidth: viewport.width,
});
type Renderer = Awaited<ReturnType<typeof create>>;
const mounted: Renderer[] = [];

afterEach(async () => {
  for (const renderer of mounted.splice(0)) await renderer.unmount();
});

async function scene(options: { running?: boolean; active?: boolean } = {}) {
  const motion: { current: Motion } = {
    current: {
      target: { x: 0, y: 0 },
      pointer: { x: 0, y: 0 },
      open: 1,
      hovered: null,
      invalidate: vi.fn(),
      moving: false,
    },
  };
  let camera!: PerspectiveCamera;
  function CaptureCamera() {
    camera = useThree((state) => state.camera) as PerspectiveCamera;
    return null;
  }
  const props = {
    graph,
    view,
    viewport,
    motion,
    active: options.active ?? true,
    running: options.running ?? true,
    onReady: vi.fn(),
    onFailure: vi.fn(),
    onSelect: vi.fn(),
    onBranch: vi.fn(),
    onFocus: vi.fn(),
    onPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    onPointerUp: vi.fn(),
    onKeyDown: vi.fn(),
  };
  const element = () => (
    <>
      <SpatialWorld {...props} />
      <CaptureCamera />
    </>
  );
  const renderer = await create(element(), {
    width: viewport.width,
    height: viewport.height,
    camera: { fov: 38, position: [0, 0, cameraDistance(viewport.height)] },
  });
  mounted.push(renderer);
  await renderer.advanceFrames(1, 1 / 60);
  camera.updateMatrixWorld();
  return {
    renderer,
    motion,
    camera,
    props,
    update: () => renderer.update(element()),
    person: (id: string) =>
      renderer.scene.findByProps({ name: `person:${id}` }).instance as Group,
    paper: () =>
      renderer.scene.findByProps({ name: "ink-scroll" }).instance as Mesh,
    lines: () =>
      renderer.scene
        .findAll((node) => node.instance instanceof Line)
        .map((node) => node.instance as Line),
  };
}

function project(position: Vector3, camera: PerspectiveCamera) {
  const ndc = position.clone().project(camera);
  return {
    x: ((ndc.x + 1) * viewport.width) / 2,
    y: ((1 - ndc.y) * viewport.height) / 2,
  };
}

describe("spatial scroll scene integration (without GPU)", () => {
  it("moves a newly selected name continuously and retargets from its visible position", async () => {
    const s = await scene();
    const change = async (id: string) => {
      s.props.graph = buildAtlas({
        people: loadPeopleFromDisk(), edges: loadEdgesFromDisk(),
        selectedId: id, mode: "scroll", viewportWidth: viewport.width,
      });
      await s.update();
    };
    const before = project(s.person("ma-ji").position, s.camera);
    await change("ma-ji");
    const goal = s.props.graph.nodes.find((n) => n.person.id === "ma-ji")!;
    await s.renderer.advanceFrames(1, 1 / 60);
    const first = project(s.person("ma-ji").position, s.camera);
    expect(Math.abs(first.x - before.x)).toBeLessThan(Math.abs(goal.x - before.x) * 0.02);
    await s.renderer.advanceFrames(20, 1 / 60);
    const midway = project(s.person("ma-ji").position, s.camera);
    expect(Math.abs(midway.x - goal.x)).toBeGreaterThan(10);
    expect(Math.abs(midway.x - goal.x)).toBeLessThan(Math.abs(before.x - goal.x));
    await change("hou-baolin");
    await s.renderer.advanceFrames(1, 1 / 60);
    const retargeted = project(s.person("ma-ji").position, s.camera);
    expect(Math.abs(retargeted.x - midway.x)).toBeLessThan(2);
    await s.renderer.advanceFrames(60, 1 / 60);
    const final = s.props.graph.nodes.find((n) => n.person.id === "ma-ji")!;
    expect(project(s.person("ma-ji").position, s.camera).x).toBeCloseTo(final.x, 1);
  });

  it("keeps static reading immediate and lets dragging interrupt selection travel", async () => {
    for (const running of [true, false]) {
      const s = await scene({ running });
      s.props.graph = buildAtlas({
        people: loadPeopleFromDisk(), edges: loadEdgesFromDisk(),
        selectedId: "ma-ji", mode: "scroll", viewportWidth: viewport.width,
      });
      await s.update();
      await s.renderer.advanceFrames(1, 1 / 60);
      if (running) {
        s.motion.current.navigationInterrupted = true;
        await s.renderer.advanceFrames(1, 1 / 60);
      }
      const goal = s.props.graph.nodes.find((n) => n.person.id === "ma-ji")!;
      expect(project(s.person("ma-ji").position, s.camera).x).toBeCloseTo(goal.x, 1);
    }
  });
  it("projects real person groups onto their genealogy slots with the selected person in front", async () => {
    const state = await scene();
    const selected = state.person("hou-baolin");
    const depths = new Set<number>();
    for (const node of graph.nodes) {
      const person = state.person(node.person.id);
      const projected = project(person.position, state.camera);
      expect(projected.x, node.person.name).toBeCloseTo(node.x, 5);
      expect(projected.y, node.person.name).toBeCloseTo(node.y, 5);
      if (!node.selected)
        expect(person.position.z).toBeLessThan(selected.position.z);
      depths.add(person.position.z);
    }
    expect(depths.size).toBeGreaterThan(2);
    expect(state.props.onReady).toHaveBeenCalledOnce();
    expect(state.props.onFailure).not.toHaveBeenCalled();
  });

  it("deforms the paper while keeping name slots fixed when the pointer moves", async () => {
    const state = await scene();
    const geometry = state.paper().geometry;
    const before = Array.from(geometry.attributes.position.array);
    const anchorBefore = project(
      state.person("hou-baolin").position,
      state.camera,
    );
    state.motion.current.target = { x: 0.9, y: 0.7 };
    await state.renderer.advanceFrames(45, 1 / 60);
    const after = Array.from(geometry.attributes.position.array);
    expect(
      after.some((value, index) => Math.abs(value - before[index]) > 1),
    ).toBe(true);
    expect(after.every(Number.isFinite)).toBe(true);
    expect(state.motion.current.pointer.x).toBeGreaterThan(0.8);
    const anchorAfter = project(
      state.person("hou-baolin").position,
      state.camera,
    );
    expect(anchorAfter.x).toBeCloseTo(anchorBefore.x, 5);
    expect(Math.abs(anchorAfter.x - anchorBefore.x)).toBeLessThan(14);
    expect(Math.abs(anchorAfter.y - anchorBefore.y)).toBeLessThan(10);
  });

  it("raises a hovered person while its real Three line follows its depth and highlights", async () => {
    const state = await scene();
    // Hover must not move the acquisition target, including away from the
    // canvas center where parallax is already active.
    state.motion.current.target = { x: 0.7, y: 0.5 };
    await state.renderer.advanceFrames(200, 1 / 60);
    const person = state.person("hou-baolin");
    const initial = person.position.clone();
    const edgeIndex = graph.edges.findIndex(
      (edge) => edge.from === "hou-baolin",
    );
    expect(edgeIndex).toBeGreaterThanOrEqual(0);
    const line = state.lines()[edgeIndex];
    const beforeZ = line.geometry.attributes.position.getZ(0);
    state.motion.current.hovered = "hou-baolin";
    await state.renderer.advanceFrames(45, 1 / 60);
    const after = project(person.position, state.camera);
    const before = project(initial, state.camera);
    expect(person.position.z - initial.z).toBeGreaterThan(20);
    expect(person.position.z - initial.z).toBeLessThanOrEqual(24);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
    expect(line.geometry.attributes.position.getZ(0)).toBeCloseTo(
      person.position.z - 3,
      4,
    );
    expect(line.geometry.attributes.position.getY(0)).toBeCloseTo(
      person.position.y,
      4,
    );
    expect(line.geometry.attributes.position.getZ(0)).toBeGreaterThan(
      beforeZ + 20,
    );
    const material = Array.isArray(line.material)
      ? line.material[0]
      : line.material;
    expect(material.opacity).toBe(1);
  });

  it("keeps the hidden scene stationary even when pointer and hover targets change", async () => {
    const state = await scene();
    const position = state.person("hou-baolin").position.clone();
    const vertices = Array.from(
      state.paper().geometry.attributes.position.array,
    );
    state.props.active = false;
    await state.update();
    state.motion.current.target = { x: 1, y: -1 };
    state.motion.current.hovered = "hou-baolin";
    await state.renderer.advanceFrames(30, 1 / 60);
    expect(state.person("hou-baolin").position.equals(position)).toBe(true);
    expect(
      Array.from(state.paper().geometry.attributes.position.array),
    ).toEqual(vertices);
    expect(state.motion.current.pointer).toEqual({ x: 0, y: 0 });
  });

  it("restores a stable open reading pose when animation is disabled and ignores further pointer input", async () => {
    const state = await scene();
    const restingPosition = state.person("hou-baolin").position.clone();
    state.motion.current.target = { x: 0.9, y: 0.8 };
    state.motion.current.open = 0.2;
    state.motion.current.hovered = "hou-baolin";
    await state.renderer.advanceFrames(10, 1 / 60);
    expect(state.person("hou-baolin").position.equals(restingPosition)).toBe(
      false,
    );
    state.props.running = false;
    await state.update();
    await state.renderer.advanceFrames(1, 1 / 60);
    expect(state.motion.current.pointer).toEqual({ x: 0, y: 0 });
    expect(state.motion.current.open).toBe(1);
    expect(state.person("hou-baolin").position.equals(restingPosition)).toBe(
      true,
    );
    const vertices = Array.from(
      state.paper().geometry.attributes.position.array,
    );
    state.motion.current.target = { x: -1, y: 1 };
    await state.renderer.advanceFrames(20, 1 / 60);
    expect(
      Array.from(state.paper().geometry.attributes.position.array),
    ).toEqual(vertices);
    expect(state.motion.current.moving).toBe(false);
  });
});

it("keeps the paper thick and front/back materials separate after deformation", async () => {
  const state = await scene();
  state.motion.current.target = { x: 0.8, y: 0.4 };
  await state.renderer.advanceFrames(40, 1 / 60);
  const paper = state.paper();
  expect(Array.isArray(paper.material)).toBe(true);
  const p = paper.geometry.attributes.position;
  const half = p.count / 2;
  for (const index of [0, 100, half - 1])
    expect(p.getZ(index) - p.getZ(index + half)).toBeCloseTo(1.4, 3);
  expect(
    state.renderer.scene.findByProps({ name: "unpainted-paper-backdrop" }),
  ).toBeTruthy();
  const backdrop = state.renderer.scene.findByProps({ name: "unpainted-paper-backdrop" }).instance as Mesh;
  expect((backdrop.material as import("three").MeshStandardMaterial).map).toBeNull();
});

it("keeps the genealogy as the focal plane between slower distant scenery and faster foreground", async () => {
  const state = await scene();
  const pine = state.renderer.scene.findByProps({ name: "scenery:pine" }).instance as Mesh;
  const mountain = state.renderer.scene.findByProps({ name: "scenery:mountain" }).instance as Mesh;
  const beforePine = project(pine.position, state.camera), beforeMountain = project(mountain.position, state.camera);
  const beforeName = project(state.person("hou-baolin").position, state.camera);
  state.props.view = { ...view, x: -200 };
  await state.update();
  await state.renderer.advanceFrames(1, 1 / 60);
  const mountainMove = project(mountain.position,state.camera).x-beforeMountain.x;
  const nameMove = project(state.person("hou-baolin").position,state.camera).x-beforeName.x;
  expect(mountainMove).toBeLessThan(0);
  expect(Math.abs(mountainMove)).toBeLessThanOrEqual(24);
  expect((mountain.material as import("three").MeshBasicMaterial).depthTest).toBe(false);
  expect(nameMove).toBeCloseTo(-200, 3);
  expect(project(pine.position,state.camera).x-beforePine.x).toBeCloseTo(-270, 3);
  expect(pine.scale.y).toBeGreaterThan(viewport.height * .3);
  expect(pine.scale.y).toBeLessThan(viewport.height * .6);
});

it("animates a clickable rear branch into the front depth plane", async () => {
  const s = await scene();
  const make = (selectedId: string) => buildFixedScroll({ people: loadPeopleFromDisk(), edges: loadEdgesFromDisk(), selectedId, mode: "scroll" });
  s.props.graph = make("hou-baolin");
  await s.update();
  await s.renderer.advanceFrames(100, 1/60);
  const rear = s.person("guo-degang").position.z;
  expect(rear).toBeLessThan(0);
  expect(s.person("ma-ji").position.z).toBeGreaterThan(s.person("hou-baolin").position.z);
  s.props.graph = make("guo-degang");
  await s.update();
  await s.renderer.advanceFrames(1, 1/60);
  const first = s.person("guo-degang").position.z;
  expect(first).toBeGreaterThan(rear);
  expect(first).toBeLessThan(0);
  await s.renderer.advanceFrames(100, 1/60);
  expect(s.person("guo-degang").position.z).toBeGreaterThan(0);
  expect(s.person("guo-degang").position.z).toBeGreaterThan(s.person("ma-sanli").position.z);
});

it("rotates a generation cloud in depth while keeping every person in the scene", async () => {
  const s = await scene();
  s.props.graph = buildFixedScroll({ people: loadPeopleFromDisk(), edges: loadEdgesFromDisk(), selectedId: "hou-baolin", mode: "scroll" });
  await s.update();
  await s.renderer.advanceFrames(120, 1 / 60);
  const before = s.person("chang-baofeng").position.clone();
  s.motion.current.clusterPointer = { x: .9, y: 0 };
  await s.renderer.advanceFrames(120, 1 / 60);
  const after = s.person("chang-baofeng").position;
  expect(after.x).not.toBeCloseTo(before.x, 2);
  expect(after.z).not.toBeCloseTo(before.z, 2);
  for (const node of s.props.graph.nodes) expect(s.person(node.person.id)).toBeTruthy();
});

it("keeps distant mountain silhouettes inside the viewport when zoomed and at either scroll end", async () => {
  const state = await scene();
  for (const x of [-20000, 20000]) {
    state.props.view = { ...view, x, scale: 2 };
    await state.update();
    await state.renderer.advanceFrames(2, 1 / 60);
    for (const kind of ["mountain"]) {
      const mountain = state.renderer.scene.findByProps({ name: `scenery:${kind}` }).instance as Mesh;
      const topLeft = mountain.position.clone().add(new Vector3(-mountain.scale.x / 2, mountain.scale.y / 2, 0));
      const bottomRight = mountain.position.clone().add(new Vector3(mountain.scale.x / 2, -mountain.scale.y / 2, 0));
      const a = project(topLeft, state.camera), b = project(bottomRight, state.camera);
      expect(a.x).toBeGreaterThanOrEqual(viewport.width * .06 - .01);
      expect(b.x).toBeLessThanOrEqual(viewport.width * .94 + .01);
      expect(a.y).toBeGreaterThan(0);
      expect(b.y).toBeLessThan(viewport.height);
    }
  }
});

it.each([false, true])("matches parallax.js inverted axes from cursor through projection (fixed=%s)", async (fixed) => {
  const s = await scene();
  if (fixed) {
    s.props.graph = buildFixedScroll({ people: loadPeopleFromDisk(), edges: loadEdgesFromDisk(), selectedId: "zhao-zhenduo", mode: "scroll" });
    await s.update();
  }
  await s.renderer.advanceFrames(90, 1 / 60);
  const names = ["scenery:mountain", "scenery:bridge", "scenery:pine", "river-water:far", "river-water:middle", "river-water:near"];
  const meshes = names.map(name => s.renderer.scene.findByProps({ name }).instance as Mesh);
  const before = meshes.map(mesh => project(mesh.position, s.camera));
  // Cursor at upper right: every layer must move down and left.
  const rect = { left: 0, top: 0, ...viewport };
  s.motion.current.target = scrollPointerFromClient(1080, 70, rect);
  s.motion.current.clusterPointer = s.motion.current.target;
  await s.renderer.advanceFrames(90, 1 / 60);
  meshes.forEach((mesh, i) => {
    const after = project(mesh.position, s.camera);
    expect(after.y).toBeGreaterThan(before[i].y);
    expect(after.x).toBeLessThan(before[i].x);
  });
  s.motion.current.target = scrollPointerFromClient(120, 630, rect);
  s.motion.current.clusterPointer = s.motion.current.target;
  await s.renderer.advanceFrames(90, 1 / 60);
  meshes.forEach((mesh, i) => {
    const after = project(mesh.position, s.camera);
    expect(after.y).toBeLessThan(before[i].y);
    expect(after.x).toBeGreaterThan(before[i].x);
  });
});

it("moves scenery and fixed-scroll names in both axes while keeping distant ink opacity constant", async () => {
  const s = await scene();
  s.props.graph = buildFixedScroll({ people: loadPeopleFromDisk(), edges: loadEdgesFromDisk(), selectedId: "zhao-zhenduo", mode: "scroll" });
  await s.update();
  await s.renderer.advanceFrames(90, 1 / 60);
  const get = (kind: string) => s.renderer.scene.findByProps({ name: `scenery:${kind}` }).instance as Mesh;
  const far = get("mountain"), middle = get("bridge"), near = get("pine");
  const meshes = [far, middle, near, s.person("zhao-zhenduo"), get("river-gorge")];
  const before = meshes.map(mesh => project(mesh.position, s.camera));
  const shoreBefore = project(get("distant-shore").position, s.camera);
  s.motion.current.clusterPointer = { x: .8, y: .8 };
  await s.renderer.advanceFrames(90, 1 / 60);
  const moved = meshes.map((mesh, i) => {
    const after = project(mesh.position, s.camera);
    return { x: after.x - before[i].x, y: after.y - before[i].y };
  });
  for (const delta of moved) {
    expect(Math.abs(delta.x)).toBeGreaterThan(1);
    expect(Math.abs(delta.y)).toBeGreaterThan(1);
  }
  expect(Math.abs(moved[4].x)).toBeGreaterThan(10);
  expect(Math.abs(moved[4].y)).toBeGreaterThan(7);
  const shoreAfter = project(get("distant-shore").position, s.camera);
  expect(Math.abs(shoreAfter.x - shoreBefore.x)).toBeGreaterThan(.1);
  expect(Math.abs(shoreAfter.x - shoreBefore.x)).toBeLessThan(Math.abs(moved[0].x));
  expect(Math.abs(shoreAfter.y - shoreBefore.y)).toBeLessThan(Math.abs(moved[0].y));
  expect(Math.abs(moved[0].y)).toBeLessThan(Math.abs(moved[1].y));
  expect(Math.abs(moved[1].y)).toBeLessThan(Math.abs(moved[2].y));
  const opening = get("opening-cloud-village");
  const opacity = (opening.material as import("three").MeshBasicMaterial).opacity;
  s.props.view = { ...view, x: -3000 };
  await s.update();
  await s.renderer.advanceFrames(90, 1 / 60);
  expect((opening.material as import("three").MeshBasicMaterial).opacity).toBe(opacity);
  expect(opacity).toBeGreaterThan(.5);
});

it("animates water and side-view boats, wraps outside the viewport, and pauses both for static reading", async () => {
  const s = await scene();
  const boat = s.renderer.scene.findByProps({ name: "scenery:boat" }).instance as Mesh;
  const farBoat = s.renderer.scene.findByProps({ name: "scenery:boat-distant" }).instance as Mesh;
  const material = (s.paper().material as import("three").MeshStandardMaterial[])[0];
  const startTime = material.userData.waterTime.value;
  const start = project(boat.position, s.camera).x;
  const farStart = project(farBoat.position, s.camera).x;
  await s.renderer.advanceFrames(60, 1 / 60);
  expect(material.userData.waterTime.value).toBeCloseTo(startTime + 1);
  expect(project(boat.position, s.camera).x - start).toBeCloseTo(12 * .82);
  expect(project(farBoat.position, s.camera).x - farStart).toBeCloseTo(7 * .82);
  s.props.running = false;
  await s.update();
  await s.renderer.advanceFrames(1, 1 / 60);
  const stopped = boat.position.clone();
  const pausedTime = material.userData.waterTime.value;
  await s.renderer.advanceFrames(60, 1 / 60);
  expect(boat.position.equals(stopped)).toBe(true);
  expect(material.userData.waterTime.value).toBe(pausedTime);
});


it("moves boats and the gorge with the scroll instead of pinning them to the screen", async () => {
  const s = await scene();
  s.props.running = false;
  await s.update();
  await s.renderer.advanceFrames(2, 1 / 60);
  const get = (kind: string) => s.renderer.scene.findByProps({ name: `scenery:${kind}` }).instance as Mesh;
  const boat = get("boat"), gorge = get("river-gorge");
  const boatX = project(boat.position, s.camera).x;
  const gorgeX = project(gorge.position, s.camera).x;
  const boatSize = boat.scale.x;
  const garden = get("river-garden");
  const distance = cameraDistance(viewport.height);
  const projectedWidth = (m: Mesh) => m.scale.x * distance / (distance - m.position.z);
  expect(projectedWidth(boat) / projectedWidth(garden)).toBeCloseTo(.22);
  s.props.view = { ...view, x: -200 };
  await s.update();
  await s.renderer.advanceFrames(2, 1 / 60);
  expect(project(boat.position, s.camera).x - boatX).toBeCloseTo(-200 * .82);
  expect(project(gorge.position, s.camera).x - gorgeX).toBeCloseTo(-200 * .28);
  s.props.view = { ...view, scale: 1.5 };
  await s.update();
  await s.renderer.advanceFrames(2, 1 / 60);
  expect(boat.scale.x / boatSize).toBeCloseTo(1.5);
});

it("layers flowing water around the gorge and bridge with slower distant parallax", async () => {
  const s = await scene();
  const mesh = (name: string) => s.renderer.scene.findByProps({ name }).instance as Mesh;
  const far = mesh("river-water:far"), middle = mesh("river-water:middle"), near = mesh("river-water:near");
  expect(far.renderOrder).toBeLessThan(mesh("scenery:river-gorge").renderOrder);
  expect(middle.renderOrder).toBeLessThan(mesh("scenery:bridge").renderOrder);
  expect(near.renderOrder).toBeGreaterThan(mesh("scenery:bridge").renderOrder);
  const water = [far, middle, near].map(m => m.material as import("three").ShaderMaterial);
  const initial = water.map(m => m.uniforms.time.value);
  await s.renderer.advanceFrames(60, 1 / 60);
  water.forEach((m, i) => expect(m.uniforms.time.value - initial[i]).toBeCloseTo(1));
  s.props.running = false;
  s.props.view = { ...view, x: -200 };
  await s.update();
  await s.renderer.advanceFrames(2, 1 / 60);
  expect(water[0].uniforms.offset.value.x).toBeLessThan(water[1].uniforms.offset.value.x);
  expect(water[1].uniforms.offset.value.x).toBeLessThan(water[2].uniforms.offset.value.x);
  const paused = water.map(m => m.uniforms.time.value);
  await s.renderer.advanceFrames(30, 1 / 60);
  water.forEach((m, i) => expect(m.uniforms.time.value).toBe(paused[i]));
});
