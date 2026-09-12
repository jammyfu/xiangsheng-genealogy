import { expect, it } from "vitest";
import { sceneryLayout, SCENERY_KINDS, distantSceneryX, sceneryTravelRate, endpointPresence, SCROLL_INSCRIPTIONS, riverBoatX } from "./scenery-layout";
it("uses every landscape image only once across the entire scroll", () => {
  const pieces = sceneryLayout();
  expect(new Set(pieces.map(p => p.kind)).size).toBe(pieces.length);
  expect(pieces.every(p => SCENERY_KINDS.includes(p.kind))).toBe(true);
  expect(sceneryLayout()).toEqual(pieces);
});
it("keeps near framing at the endpoints and scenery below the reading band", () => {
  for (const p of sceneryLayout()) {
    expect(p.y).toBeGreaterThanOrEqual(.68);
    if (p.depth > 0) expect(p.x < .1 || p.x > .9).toBe(true);
    expect(p.size).toBeGreaterThan(0);
  }
});
it("composes distinct reaches with varied scale instead of repeating tiles", () => {
  const p = sceneryLayout();
  const scenes = p.filter(p => p.kind.startsWith("river-"));
  expect(scenes).toHaveLength(3);
  expect(new Set(scenes.map(p => p.size)).size).toBe(3);
  expect(scenes[0].x).toBeLessThan(scenes[1].x);
  expect(scenes[1].x).toBeLessThan(scenes[2].x);
  expect(p.find(p => p.kind === "boat")!.size).toBeLessThan(p.find(p => p.kind === "bridge")!.size);
});

it("keeps complete distant silhouettes within horizontal margins at every scroll endpoint", () => {
  for (const viewport of [360, 1200, 3840]) {
    const width = viewport * .76;
    for (const target of [-20000, -1000, 0, 1000, 20000]) {
      const x = distantSceneryX(target, width, viewport);
      expect(x - width / 2).toBeGreaterThanOrEqual(viewport * .06 - .001);
      expect(x + width / 2).toBeLessThanOrEqual(viewport * .94 + .001);
    }
  }
});
it("moves mountains and gorges more slowly than the middle and foreground", () => {
  const pieces = sceneryLayout();
  const rate = (kind: string) => sceneryTravelRate(pieces.find(p => p.kind === kind)!);
  expect(rate("mountain")).toBe(.12);
  expect(rate("river-gorge")).toBe(.28);
  expect(rate("river-gorge")).toBeLessThan(rate("bridge"));
  expect(rate("pine")).toBe(1.35);
});

it("reveals different endpoint vistas gradually without carrying them into the middle", () => {
  const bounds = { x: 100, width: 4000 };
  expect(endpointPresence("opening", 100, bounds)).toBe(1);
  expect(endpointPresence("closing", 4100, bounds)).toBe(1);
  expect(endpointPresence("opening", 2100, bounds)).toBe(0);
  expect(endpointPresence("closing", 2100, bounds)).toBe(0);
  expect(endpointPresence("opening", 500, bounds)).toBeGreaterThan(endpointPresence("opening", 900, bounds));
  expect(SCROLL_INSCRIPTIONS.map(i => i.title)).toEqual(["一脉源流", "余韵长流"]);
  expect(sceneryLayout().filter(p => p.kind === "opening-cloud-village" || p.kind === "closing-peaks-temple")).toHaveLength(2);
});

it("wraps sailing boats only while their full silhouette is offscreen", () => {
  for (const distant of [false, true]) {
    const width = 1200, boatWidth = 80;
    const crossing = (width + boatWidth * 2 - width * (distant ? .76 : .32)) / (distant ? 7 : 12);
    expect(riverBoatX(crossing - .001, width, boatWidth, distant) - boatWidth / 2).toBeGreaterThan(width);
    expect(riverBoatX(crossing + .001, width, boatWidth, distant) + boatWidth / 2).toBeLessThan(0);
  }
});
