import { afterEach, describe, expect, it, vi } from "vitest";
import { gsap } from "gsap";
import { revealScroll, viewDirection } from "./motion";

afterEach(() => {
  gsap.globalTimeline.clear();
  gsap.ticker.sleep();
});
describe("GSAP scroll motion contract", () => {
  it("moves the actual geometry input monotonically and requests render updates", () => {
    const state = { open: 0.05, invalidate: vi.fn() };
    const tween = revealScroll(state, true)!;
    tween.pause().progress(0.3);
    const intermediate = state.open;
    expect(intermediate).toBeGreaterThan(0.05);
    expect(intermediate).toBeLessThan(1);
    tween.progress(0.7);
    expect(state.open).toBeGreaterThan(intermediate);
    tween.progress(1);
    expect(state.open).toBe(1);
    expect(state.invalidate).toHaveBeenCalled();
  });
  it("reduced motion cancels an existing reveal and presents its final pose", () => {
    const state = { open: 0.05, invalidate: vi.fn() };
    revealScroll(state, true)!.pause().progress(0.25);
    expect(revealScroll(state, false)).toBeNull();
    expect(state.open).toBe(1);
    expect(gsap.getTweensOf(state)).toHaveLength(0);
  });
  it("does not replay a completed reveal or leave competing tweens", () => {
    const state = { open: 0.1, invalidate: vi.fn() };
    revealScroll(state, true);
    const replacement = revealScroll(state, true)!;
    expect(gsap.getTweensOf(state)).toEqual([replacement]);
    replacement.progress(1);
    expect(revealScroll(state, true)).toBeNull();
  });
  it("uses tab order for directional navigation", () => {
    expect(viewDirection("scroll", "book")).toBe(1);
    expect(viewDirection("timeline", "tree")).toBe(-1);
    expect(viewDirection("book", "book")).toBe(0);
  });
});
