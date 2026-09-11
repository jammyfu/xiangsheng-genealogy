import { afterEach, describe, expect, it, vi } from "vitest";
import { create } from "@react-three/test-renderer";
import { useThree } from "@react-three/fiber";
import { Group, Line, Mesh, PerspectiveCamera, Vector3 } from "three";
import { SpatialWorld, type Motion } from "./ScrollScene";
import { buildAtlas } from "../lib/atlas";
import { cameraDistance } from "../lib/scroll-space";
import { loadEdgesFromDisk, loadPeopleFromDisk } from "../lib/loadCatalog.node";

// These tests execute the real Three scene and frame callbacks in Node. They do
// not validate GPU output or DOM label layout; Html and the image loader are the
// only scene dependencies replaced so rendering needs no browser or network.
vi.mock("@react-three/drei", async () => {
  const { Texture } = await import("three");
  const texture = new Texture();
  return { Html: () => null, useTexture: () => texture };
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
  await Promise.all(mounted.splice(0).map((renderer) => renderer.unmount()));
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

  it("deforms the actual paper vertices and gives names bounded parallax when the pointer moves", async () => {
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
    expect(anchorAfter.x - anchorBefore.x).toBeGreaterThan(0);
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
    expect(material.opacity).toBeCloseTo(0.9);
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
