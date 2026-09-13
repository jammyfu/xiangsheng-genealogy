// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { TimelineView } from "./TimelineView";
import { peopleById } from "../lib/catalog";
import { events, sortEvents } from "../lib/events";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("./InkWorld", () => ({ default: () => <div>空间场景</div> }));
const ordered = sortEvents(events);
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function Harness() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output>{location.search}</output>
      <button onClick={() => navigate(-1)}>浏览器返回</button>
      <button onClick={() => navigate(1)}>浏览器前进</button>
      <button
        onClick={() => {
          const p = new URLSearchParams(location.search);
          p.set("view", p.get("view") === "book" ? "timeline" : "book");
          navigate({ search: p.toString() });
        }}
      >
        切换阅法
      </button>
      {new URLSearchParams(location.search).get("view") !== "book" && (
        <TimelineView person={peopleById["hou-baolin"]} onSelect={() => {}} />
      )}
    </>
  );
}
async function mount(search: string) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[`/p/hou-baolin?${search}`]}>
        <Harness />
      </MemoryRouter>,
    ),
  );
}
async function click(name: string) {
  const button = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === name || b.getAttribute("aria-label") === name,
  )!;
  expect(button).toBeTruthy();
  await act(async () => button.click());
}
const params = () =>
  new URLSearchParams(host.querySelector("output")!.textContent!);
const heading = () =>
  host.querySelector(".journey-detail .event-heading")!.textContent;
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
});

it("restores deep links, event history and the same event after view unmount", async () => {
  await mount(`view=timeline&scope=all&event=${ordered[2].id}&q=侯&gen=宝`);
  expect(heading()).toContain(ordered[2].title);
  await click("下一事件");
  expect(params().get("event")).toBe(ordered[3].id);
  expect(heading()).toContain(ordered[3].title);
  await click("浏览器返回");
  expect(heading()).toContain(ordered[2].title);
  await click("浏览器前进");
  expect(heading()).toContain(ordered[3].title);
  await click("切换阅法");
  await click("切换阅法");
  expect(heading()).toContain(ordered[3].title);
  expect(params().get("q")).toBe("侯");
  expect(params().get("gen")).toBe("宝");
  await click("纪事列表");
  expect(host.querySelector('[aria-current="true"]')!.textContent).toContain(
    ordered[3].title,
  );
  await click("继续沿卷阅读此事");
  expect(heading()).toContain(ordered[3].title);
});
it("canonicalizes unknown events, clears empty results, and restores filtering through history", async () => {
  await mount("view=timeline&scope=all&event=missing");
  expect(params().get("event")).toBe(ordered[0].id);
  await click("当前人物");
  const filter = host.querySelector<HTMLSelectElement>("select")!;
  await act(async () => {
    filter.value = "work";
    filter.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(host.textContent).toContain("没有匹配的事件");
  expect(params().has("event")).toBe(false);
  await click("清除事件筛选");
  expect(params().get("event")).toBe("hou-baolin-birth");
  await click("浏览器返回");
  expect(host.textContent).toContain("没有匹配的事件");
});
