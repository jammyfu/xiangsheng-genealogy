// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { gsap } from "gsap";
import { useStudioMotion } from "./useStudioMotion";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let reduced = false;
let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;
beforeEach(() => {
  reduced = false;
  vi.stubGlobal("matchMedia", () => ({
    matches: !reduced,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
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
function Harness({ view }: { view: string }) {
  const ref = useRef<HTMLElement>(null);
  const transitioning = useStudioMotion(ref, view, "hou-baolin");
  return (
    <main ref={ref} data-phase={transitioning ? "moving" : "settled"}>
      <button>切换</button>
      <div id="main-content">{view}</div>
    </main>
  );
}
it("rapid navigation cancels old work, keeps controls usable and clears final transforms", async () => {
  await act(async () => root.render(<Harness view="scroll" />));
  const content = host.querySelector<HTMLElement>("#main-content")!;
  const first = gsap.getTweensOf(content)[0];
  await act(async () => root.render(<Harness view="book" />));
  const active = gsap.getTweensOf(content);
  expect(active).toHaveLength(1);
  expect(active).not.toContain(first);
  expect(host.querySelector("button")!.disabled).toBe(false);
  expect(content.textContent).toBe("book");
  expect(host.querySelector("main")!.dataset.phase).toBe("moving");
  await act(async () => {
    active[0].progress(1);
  });
  expect(host.querySelector("main")!.dataset.phase).toBe("settled");
  expect(content.style.transform).toBe("");
  expect(content.style.opacity).toBe("");
});
it("reduced motion exposes final content with no animation", async () => {
  reduced = true;
  await act(async () => root.render(<Harness view="book" />));
  const content = host.querySelector<HTMLElement>("#main-content")!;
  expect(gsap.getTweensOf(content)).toHaveLength(0);
  expect(content.style.opacity).toBe("");
  expect(host.querySelector("main")!.dataset.phase).toBe("settled");
});
