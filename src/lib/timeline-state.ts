import { EVENT_KIND_LABELS } from "./events";

export interface TimelineState {
  scope: "person" | "all";
  kind: string;
  presentation: "journey" | "list";
  event: string;
}

export function readTimelineState(search: string): TimelineState {
  const params = new URLSearchParams(search);
  const kind = params.get("kind") ?? "";
  return {
    scope: params.get("scope") === "all" ? "all" : "person",
    kind: Object.hasOwn(EVENT_KIND_LABELS, kind) ? kind : "",
    presentation: params.get("presentation") === "list" ? "list" : "journey",
    event: params.get("event") ?? "",
  };
}

export function updateTimelineSearch(
  search: string,
  patch: Partial<TimelineState>,
) {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(patch)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return params.toString();
}
