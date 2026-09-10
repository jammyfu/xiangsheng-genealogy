// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, Children, isValidElement, StrictMode, useState } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { createRoot as createDOMRoot } from "react-dom/client";
import ScrollScene, { SpatialWorld } from "./ScrollScene";
import { buildAtlas } from "../lib/atlas";
import { loadEdgesFromDisk, loadPeopleFromDisk } from "../lib/loadCatalog.node";

const gpu = vi.hoisted(() => ({
  construct: vi.fn(),
  dispose: vi.fn(),
  configure: vi.fn(),
  render: vi.fn(),
  unmount: vi.fn(),
  createRoot: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return {
    ...actual,
    WebGLRenderer: class {
      toneMapping = 0;
      constructor(options: unknown) {
        gpu.construct(options);
      }
      dispose = gpu.dispose;
    },
  };
});
vi.mock("@react-three/fiber", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@react-three/fiber")>()),
  createRoot: gpu.createRoot,
  extend: vi.fn(),
}));
vi.mock("@react-three/drei", () => ({ Html: () => null, useTexture: vi.fn() }));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const viewport = { width: 1200, height: 700 };
const graph = buildAtlas({
  people: loadPeopleFromDisk(),
  edges: loadEdgesFromDisk(),
  selectedId: "hou-baolin",
  mode: "scroll",
  viewportWidth: viewport.width,
});
const roots: ReturnType<typeof createDOMRoot>[] = [];
let reduced = false;
let visible: DocumentVisibilityState = "visible";
const mediaListeners = new Set<() => void>();
const rootMock = {
  configure: gpu.configure,
  render: gpu.render,
  unmount: gpu.unmount,
};
type RootConfiguration = {
  onCreated?: (state: { invalidate: typeof gpu.invalidate }) => void;
  dpr?: number;
  flat?: boolean;
  camera?: unknown;
};
let latestConfiguration: RootConfiguration | undefined;
let providerMounted = false;

beforeEach(() => {
  vi.clearAllMocks();
  reduced = false;
  visible = "visible";
  mediaListeners.clear();
  latestConfiguration = undefined;
  providerMounted = false;
  gpu.construct.mockReset();
  gpu.configure
    .mockReset()
    .mockImplementation(async (options: RootConfiguration) => {
      // R3F stores each configure call's callback; Provider invokes the latest
      // callback only when the first root render mounts, not during configure.
      latestConfiguration = options;
      return rootMock;
    });
  gpu.render.mockReset().mockImplementation(() => {
    if (providerMounted) return;
    providerMounted = true;
    latestConfiguration?.onCreated?.({ invalidate: gpu.invalidate });
  });
  gpu.createRoot.mockReturnValue(rootMock);
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visible,
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return reduced;
      },
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: (_type: string, callback: () => void) =>
        mediaListeners.add(callback),
      removeEventListener: (_type: string, callback: () => void) =>
        mediaListeners.delete(callback),
    })),
  );
});

afterEach(async () => {
  await act(async () => {
    roots.splice(0).forEach((root) => root.unmount());
  });
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount(
  options: { strict?: boolean; fallback?: boolean; scale?: number } = {},
) {
  const props: ComponentProps<typeof ScrollScene> = {
    graph,
    viewport,
    view: { x: 0, y: 0, scale: options.scale ?? 1 },
    active: true,
    onSelect: vi.fn(),
    onBranch: vi.fn(),
    onFocus: vi.fn(),
    onFailure: vi.fn(),
    onPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    onPointerUp: vi.fn(),
    onKeyDown: vi.fn(),
  };
  function Host() {
    const [failed, setFailed] = useState(false);
    return failed ? (
      <p role="status">平面谱系已就绪</p>
    ) : (
      <ScrollScene
        {...props}
        onFailure={() => {
          props.onFailure();
          if (options.fallback) setFailed(true);
        }}
      />
    );
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createDOMRoot(container);
  roots.push(root);
  await act(async () => {
    root.render(
      options.strict ? (
        <StrictMode>
          <Host />
        </StrictMode>
      ) : (
        <Host />
      ),
    );
  });
  const area = () => container.querySelector<HTMLDivElement>(".scroll-space")!;
  if (area())
    vi.spyOn(area(), "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: viewport.width,
      bottom: viewport.height,
      ...viewport,
      toJSON: () => ({}),
    });
  return {
    container,
    root,
    props,
    area,
    button: () =>
      container.querySelector<HTMLButtonElement>(".scroll-motion-toggle")!,
  };
}

function findWorld(
  node: ReactNode,
): ReactElement<ComponentProps<typeof SpatialWorld>> | undefined {
  if (!isValidElement<{ children?: ReactNode }>(node)) return undefined;
  if (node.type === SpatialWorld)
    return node as ReactElement<ComponentProps<typeof SpatialWorld>>;
  return Children.toArray(node.props.children).map(findWorld).find(Boolean);
}

function worldProps() {
  const node = gpu.render.mock.lastCall?.[0] as ReactNode;
  const world = findWorld(node);
  expect(world, "R3F root should receive the real spatial world").toBeDefined();
  return world!.props;
}

function expectCompleteConfigurations() {
  const first = gpu.configure.mock.calls[0][0] as RootConfiguration;
  for (const [configuration] of gpu.configure.mock.calls) {
    const options = configuration as RootConfiguration;
    expect(options.dpr).toBeGreaterThan(0);
    expect(options.dpr).toBeLessThanOrEqual(1.5);
    expect(options.flat).toBe(true);
    expect(options.camera).toBeDefined();
    expect(options.camera).toBe(first.camera);
    expect(options.onCreated).toEqual(expect.any(Function));
  }
}

async function pointer(target: Element, type: string, x: number, y: number) {
  // jsdom does not implement PointerEvent. React still reads these standard
  // coordinate fields from a bubbling event dispatched under its pointer name.
  await act(async () => {
    target.dispatchEvent(
      new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }),
    );
  });
}

describe("spatial scroll DOM lifecycle (GPU root mocked)", () => {
  it("reports a renderer construction failure once under StrictMode and lets the parent replace loading with readable fallback", async () => {
    gpu.construct.mockImplementation(() => {
      throw new Error("WebGL unavailable");
    });
    const state = await mount({ strict: true, fallback: true });
    expect(gpu.construct).toHaveBeenCalledOnce();
    expect(state.props.onFailure).toHaveBeenCalledOnce();
    expect(gpu.createRoot).not.toHaveBeenCalled();
    expect(state.container.textContent).toBe("平面谱系已就绪");
    expect(state.container.querySelector("canvas")).toBeNull();
  });

  it("catches rejected asynchronous root configuration and releases the failed renderer on fallback", async () => {
    gpu.configure.mockRejectedValue(new Error("GPU configuration rejected"));
    const state = await mount({ strict: true, fallback: true });
    expect(state.props.onFailure).toHaveBeenCalledOnce();
    expect(gpu.render).not.toHaveBeenCalled();
    expect(state.container.textContent).toBe("平面谱系已就绪");
    expect(gpu.unmount).toHaveBeenCalledOnce();
    expect(gpu.dispose).toHaveBeenCalledOnce();
  });

  it("starts one renderer, removes loading when ready, and carries pause and page visibility into the world and frame loop", async () => {
    const state = await mount({ strict: true });
    expect(gpu.construct).toHaveBeenCalledOnce();
    expect(gpu.createRoot).toHaveBeenCalledOnce();
    expectCompleteConfigurations();
    expect(worldProps().running).toBe(true);
    expect(worldProps().motion.current.invalidate).toBe(gpu.invalidate);
    expect(gpu.configure.mock.lastCall?.[0].frameloop).toBe("demand");
    await act(async () => {
      worldProps().onReady();
    });
    expect(state.container.querySelector(".scroll-loading")).toBeNull();
    expect(state.area().classList.contains("is-ready")).toBe(true);
    await act(async () => {
      state.button().click();
    });
    expect(worldProps().running).toBe(false);
    expect(state.button().getAttribute("aria-pressed")).toBe("true");
    expect(state.area().dataset.motion).toBe("still");
    await act(async () => {
      visible = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(worldProps().active).toBe(false);
    expect(gpu.configure.mock.lastCall?.[0].frameloop).toBe("never");
    await act(async () => {
      visible = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(worldProps().active).toBe(true);
    expect(worldProps().running).toBe(false);
    expect(gpu.configure.mock.lastCall?.[0].frameloop).toBe("demand");
    expectCompleteConfigurations();
    await act(async () => {
      state.root.unmount();
    });
    roots.splice(roots.indexOf(state.root), 1);
    expect(gpu.unmount).toHaveBeenCalledOnce();
    expect(gpu.dispose).toHaveBeenCalledOnce();
    expect(mediaListeners.size).toBe(0);
  });

  it("wakes a settled demand-rendered scene when the pointer moves after initial configuration", async () => {
    const state = await mount();
    const motion = worldProps().motion.current;
    motion.open = 1;
    motion.moving = false;
    motion.pointer = { x: 0, y: 0 };
    gpu.invalidate.mockClear();
    await pointer(state.area(), "pointermove", 900, 175);
    expect(motion.target).toEqual({ x: 0.5, y: 0.5 });
    expect(gpu.invalidate).toHaveBeenCalledOnce();
  });

  it("honors initial and live reduced-motion preferences while keeping the scene available for static reading", async () => {
    reduced = true;
    const state = await mount();
    expect(worldProps().running).toBe(false);
    expect(worldProps().active).toBe(true);
    expect(worldProps().motion.current.open).toBe(1);
    expect(state.button().disabled).toBe(true);
    expect(state.button().getAttribute("aria-pressed")).toBe("true");
    await act(async () => {
      reduced = false;
      mediaListeners.forEach((listener) => listener());
    });
    expect(state.button().disabled).toBe(false);
    expect(worldProps().running).toBe(true);
    await act(async () => {
      reduced = true;
      mediaListeners.forEach((listener) => listener());
    });
    expect(state.button().disabled).toBe(true);
    expect(worldProps().running).toBe(false);
  });

  it("selects and focuses the closest person from an overview blank-area click without intercepting controls", async () => {
    const state = await mount({ scale: 0.3 });
    const node = graph.nodes.find((person) => person.selected)!;
    const x = node.x * state.props.view.scale + 8;
    const y = node.y * state.props.view.scale;
    await pointer(state.area(), "pointerdown", x, y);
    await pointer(state.area(), "pointerup", x, y);
    expect(state.props.onFocus).toHaveBeenCalledWith(node);
    expect(state.props.onSelect).toHaveBeenCalledWith(node.person.id);
    vi.mocked(state.props.onSelect).mockClear();
    vi.mocked(state.props.onFocus).mockClear();
    await pointer(state.button(), "pointerdown", x, y);
    await pointer(state.button(), "pointerup", x, y);
    expect(state.props.onSelect).not.toHaveBeenCalled();
    expect(state.props.onFocus).not.toHaveBeenCalled();
  });

  it("does not turn an overview drag or a distant blank click into person selection", async () => {
    const state = await mount({ scale: 0.3 });
    const node = graph.nodes.find((person) => person.selected)!;
    const x = node.x * state.props.view.scale;
    const y = node.y * state.props.view.scale;
    await pointer(state.area(), "pointerdown", x - 20, y);
    await pointer(state.area(), "pointerup", x, y);
    expect(state.props.onSelect).not.toHaveBeenCalled();
    await pointer(state.area(), "pointerdown", 1190, 690);
    await pointer(state.area(), "pointerup", 1190, 690);
    expect(state.props.onSelect).not.toHaveBeenCalled();
    expect(state.props.onFocus).not.toHaveBeenCalled();
    expect(state.props.onPointerUp).toHaveBeenCalledTimes(2);
  });
});
