import { GENERATIONS } from "../types";

export const VIEWS = [
  { id: "scroll", label: "山水长卷" },
  { id: "tree", label: "世代谱系" },
  { id: "book", label: "人物书笺" },
  { id: "timeline", label: "生平年表" },
] as const;
export type BrowseView = (typeof VIEWS)[number]["id"];
export interface BrowseState {
  view: BrowseView;
  query: string;
  generation: string;
}

export function readBrowseState(search: string): BrowseState {
  const p = new URLSearchParams(search);
  const requested = p.get("view");
  return {
    view: VIEWS.some((v) => v.id === requested)
      ? (requested as BrowseView)
      : "scroll",
    query: p.get("q") ?? "",
    generation: GENERATIONS.some((g) => g === p.get("gen"))
      ? p.get("gen")!
      : "",
  };
}
export function updateBrowseSearch(
  search: string,
  patch: Partial<BrowseState>,
): string {
  const p = new URLSearchParams(search);
  for (const [key, value] of Object.entries(patch)) {
    const name = key === "query" ? "q" : key === "generation" ? "gen" : key;
    if (value) p.set(name, value);
    else p.delete(name);
  }
  return p.toString();
}
