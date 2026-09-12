import { expect, it } from "vitest";
import { readTimelineState, updateTimelineSearch } from "./timeline-state";

it("round trips a shared event without discarding person-view filters", () => {
  const search = updateTimelineSearch("?view=timeline&q=侯&gen=宝", {
    scope: "all",
    kind: "dispute",
    presentation: "list",
    event: "event-1",
  });
  expect(readTimelineState(search)).toEqual({
    scope: "all",
    kind: "dispute",
    presentation: "list",
    event: "event-1",
  });
  expect(new URLSearchParams(search).get("q")).toBe("侯");
  expect(new URLSearchParams(search).get("gen")).toBe("宝");
  expect(
    readTimelineState(updateTimelineSearch(search, { event: "", kind: "" }))
      .event,
  ).toBe("");
});
it("rejects invalid scope, representation and inherited object keys", () => {
  expect(
    readTimelineState("?scope=bad&presentation=bad&kind=toString"),
  ).toEqual({ scope: "person", kind: "", presentation: "journey", event: "" });
});
