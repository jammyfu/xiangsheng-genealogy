import { describe, expect, it } from "vitest";
import { readBrowseState, updateBrowseSearch } from "./browsing";

describe("persistent browsing context", () => {
  it("changes representation without discarding search, generation or active subject", () => {
    const next = updateBrowseSearch(
      "?view=scroll&q=侯&gen=宝&subject=hou-baolin",
      { view: "book" },
    );
    expect(readBrowseState(next)).toEqual({
      view: "book",
      query: "侯",
      generation: "宝",
    });
    expect(new URLSearchParams(next).get("subject")).toBe("hou-baolin");
  });
  it("normalizes unknown modes and generations without losing Unicode search", () => {
    expect(readBrowseState("?view=3d&gen=哈&q=马季")).toEqual({
      view: "scroll",
      query: "马季",
      generation: "",
    });
  });
  it("clears only explicitly reset fields and preserves URL round trips", () => {
    const next = updateBrowseSearch("?view=tree&q=曹云金&gen=明", {
      query: "",
    });
    expect(readBrowseState(next)).toEqual({
      view: "tree",
      query: "",
      generation: "明",
    });
  });
});
