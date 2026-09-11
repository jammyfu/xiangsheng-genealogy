// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { gsap } from "gsap";
import { TimelineJourney } from "./TimelineJourney";
import { events } from "../lib/events";
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("./InkWorld", () => ({
  default: ({
    items,
    selectedId,
    onSelect,
  }: {
    items: { id: string; title: string }[];
    selectedId: string;
    onSelect: (id: string) => void;
  }) => (
    <div>
      {items.map((item) => (
        <button
          key={item.id}
          aria-current={item.id === selectedId ? "true" : undefined}
          onClick={() => onSelect(item.id)}
        >
          {item.title}
        </button>
      ))}
    </div>
  ),
}));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("no-preference"),
    addListener() {},
    removeListener() {},
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
it("rapid next/previous navigation retains one current event and matching evidence", async () => {
  await act(async () =>
    root.render(<TimelineJourney items={events.slice(0, 4)} />),
  );
  const next = host.querySelector<HTMLButtonElement>(
    '[aria-label="下一事件"]',
  )!;
  await act(async () => next.click());
  await act(async () => next.click());
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="上一事件"]')!.click(),
  );
  await act(async () =>
    gsap.globalTimeline.getChildren().forEach((tween) => tween.progress(1)),
  );
  expect(host.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  expect(host.querySelector('[aria-current="true"]')!.textContent).toContain(
    events[1].title,
  );
  expect(host.querySelector(".event-heading")!.textContent).toContain(
    events[1].title,
  );
});
it("handles empty and singleton sets without invalid navigation", async () => {
  await act(async () => root.render(<TimelineJourney items={[]} />));
  expect(host.textContent).toBe("");
  await act(async () =>
    root.render(<TimelineJourney items={events.slice(0, 1)} />),
  );
  expect(host.querySelector<HTMLInputElement>("input")!.disabled).toBe(true);
  expect(
    host.querySelector<HTMLButtonElement>('[aria-label="下一事件"]')!.disabled,
  ).toBe(true);
});
