// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { gsap } from "gsap";
import type { Scene, Mesh } from "three";
import InkWorld from "./InkWorld";
const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  construct: vi.fn(),
  dispose: vi.fn(),
  textureDispose: vi.fn(),
  fail: false,
}));
vi.mock("three", async () => {
  const real = await vi.importActual<typeof import("three")>("three");
  return {
    ...real,
    WebGLRenderer: class {
      constructor() {
        mocks.construct();
        if (mocks.fail) throw new Error("WebGL unavailable");
      }
      render = mocks.render;
      dispose = mocks.dispose;
      setPixelRatio() {}
      setSize() {}
    },
    TextureLoader: class {
      load(
        _url: string,
        callback: (texture: InstanceType<typeof real.Texture>) => void,
      ) {
        const texture = new real.Texture();
        texture.dispose = mocks.textureDispose;
        callback(texture);
        return texture;
      }
    },
  };
});
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
let frames: Map<number, FrameRequestCallback>, frameId: number;
const items = [
  {
    id: "a",
    title: "甲",
    position: [0, 3, 0] as [number, number, number],
    generation: "宝",
  },
  {
    id: "b",
    title: "乙",
    position: [4, 2, -8] as [number, number, number],
    generation: "文",
  },
];
async function flush() {
  await act(async () => {
    for (const [id, callback] of [...frames]) {
      frames.delete(id);
      callback(16);
    }
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.fail = false;
  frames = new Map();
  frameId = 0;
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  gsap.ticker.sleep();
});
it("builds a real thick ribbon, alpha mountain planes and interior sky sphere", async () => {
  await act(async () =>
    root.render(
      <InkWorld
        mode="timeline"
        items={items}
        selectedId="a"
        onSelect={() => {}}
      />,
    ),
  );
  await flush();
  expect(mocks.render).toHaveBeenCalled();
  const scene = mocks.render.mock.calls[0][0] as Scene;
  const ribbon = scene.getObjectByName("time-scroll-ribbon") as Mesh;
  expect(ribbon.geometry.attributes.position.count).toBeGreaterThan(100);
  expect(scene.getObjectByName("ink-sky-dome")!.type).toBe("Mesh");
  const mountain = scene.getObjectByName("ink-mountain-0--1") as Mesh;
  expect(mountain).toBeTruthy();
  expect(Array.isArray(mountain.material)).toBe(false);
  expect((mountain.material as { transparent: boolean }).transparent).toBe(
    true,
  );
  expect(host.querySelector(".ink-world")!.getAttribute("data-renderer")).toBe(
    "threejs",
  );
});
it("keeps uncertain relationships dashed and cleans GPU resources on unmount", async () => {
  await act(async () =>
    root.render(
      <InkWorld
        mode="tree"
        items={items}
        links={[{ id: "ab", from: "a", to: "b", disputed: true }]}
        selectedId="a"
        onSelect={() => {}}
      />,
    ),
  );
  await flush();
  const scene = mocks.render.mock.calls[0][0] as Scene;
  const line = scene.children.find(
    (child) => child.type === "Line",
  ) as import("three").Line;
  expect((line.material as import("three").Material).type).toBe(
    "LineDashedMaterial",
  );
  expect(scene.getObjectByName("person:a")).toBeTruthy();
  await act(async () => root.render(<div />));
  expect(mocks.dispose).toHaveBeenCalledTimes(1);
  expect(mocks.textureDispose).toHaveBeenCalledTimes(2);
  gsap.ticker.sleep();
  expect(frames.size).toBe(0);
});
it("WebGL failure leaves semantic events and an explicit simplified-preview status", async () => {
  mocks.fail = true;
  await act(async () =>
    root.render(
      <InkWorld
        mode="timeline"
        items={items}
        selectedId="a"
        onSelect={() => {}}
      />,
    ),
  );
  await flush();
  expect(host.textContent).toContain("未启用 WebGL");
  expect(host.textContent).toContain("甲");
  expect(host.querySelector(".ink-world")!.getAttribute("data-renderer")).toBe(
    "projection-fallback",
  );
});

it("reuses the GPU context when a branch changes", async () => {
  await act(async () =>
    root.render(
      <InkWorld mode="tree" items={items} selectedId="a" onSelect={() => {}} />,
    ),
  );
  await flush();
  await act(async () =>
    root.render(
      <InkWorld
        mode="tree"
        items={[...items]}
        selectedId="b"
        onSelect={() => {}}
      />,
    ),
  );
  await flush();
  expect(mocks.construct).toHaveBeenCalledTimes(1);
  expect(mocks.dispose).not.toHaveBeenCalled();
});

it("removes past event papers from the reading window and keyboard focus", async () => {
  await act(async () =>
    root.render(
      <InkWorld
        mode="timeline"
        items={items}
        selectedId="b"
        index={1}
        onSelect={() => {}}
      />,
    ),
  );
  await flush();
  const scene = mocks.render.mock.calls.at(-1)![0] as Scene;
  expect(scene.getObjectByName("event-paper:a")!.visible).toBe(false);
  expect(scene.getObjectByName("event-paper:b")!.visible).toBe(true);
  expect((host.querySelectorAll(".ink-anchor")[0] as HTMLElement).inert).toBe(
    true,
  );
});

it("centers the selected timeline paper inside a narrow viewport", async () => {
  const width = vi
    .spyOn(HTMLElement.prototype, "clientWidth", "get")
    .mockReturnValue(390);
  const height = vi
    .spyOn(HTMLElement.prototype, "clientHeight", "get")
    .mockReturnValue(500);
  try {
    await act(async () =>
      root.render(
        <InkWorld
          mode="timeline"
          items={items}
          selectedId="b"
          index={1}
          onSelect={() => {}}
        />,
      ),
    );
    await flush();
    const label = host.querySelector(".ink-anchor.is-selected") as HTMLElement;
    const x = Number(label.style.transform.match(/translate\(([\d.-]+)px/)![1]);
    expect(x).toBeGreaterThan(120);
    expect(x).toBeLessThan(270);
    expect(label.style.visibility).toBe("visible");
  } finally {
    width.mockRestore();
    height.mockRestore();
  }
});
