# Immersive design QA

Date: 2026-09-11. Reference: `docs/design/immersive-approved.webp`.

## Result

Actual GPU rendering is now verified on local Apple M4 / ANGLE Metal, Chromium 152. The earlier cloud WebGL blocker is resolved for this local environment. Overall approved-reference fidelity is **not passed**: the wider roadmap and exact composition remain incomplete.

## Verified this iteration

- Continuous closed paper mesh with front, back, thickness, curled edge and one bounded environment painting window; no repeated rectangular panorama tiles.
- Seven independent 1254 × 1254 scenery sources rendered as transparent 3D planes. The shader removes the magenta backing for six sources; the bank source has native alpha. Twelve constrained placements produce distant mountains, grounded bank/village/bridge middle ground and foreground trees/boats. Randomizing scenery preserves the current person and URL filters.
- Real GPU screenshot at 3556 × 2000 CSS pixels: `docs/qa/depth-composition-fullscreen.png`. Fullscreen reading fills the available canvas; person details can open within it. The embedded browser uses the immersive fallback when its Fullscreen API is unavailable.
- Narrow browser composition inspected; current event camera framing and past-event visibility repaired. Intermediate evidence: `docs/qa/m2-mobile-after.png`. This is browser viewport validation, not a physical-phone test.
- Timeline selected event, scope, type and presentation survive view changes and browser history. Empty filters and invalid event URLs covered.
- 146 tests across 19 files pass; production build passes. WebGL scene showed no browser error logs. Build still reports the existing main bundle size warning.

## Limits and remaining work

- Single-source mountain/village duplicates can be recognized; additional hand-authored variations could improve natural diversity. Fine cutout silhouettes are shader-matted and are not equivalent to original alpha assets.
- Full genealogy label density, the approved sky/silhouette composition and interactive minimap remain outside this iteration. Do not interpret this as completion of all roadmap milestones or a pixel-identical approved design.
- Safari, physical touch devices, sustained GPU frame-rate and memory profiling have not been verified.
- Environment-only source is 2172 × 724; local scenery is independently redrawn at higher detail, not original 4K photography or fully volumetric terrain.

No deployment was performed. Existing historical data was not changed.

Depth composition revision: inspected the original hard collage in the actual browser. Removed duplicate depicted objects from the background, replaced it with a single empty river environment, anchored source silhouettes by their feet, added independent bank imagery and contact shading, softened mountain bases and applied distance-dependent haze. Final wide-screen screenshot archived above. Strong horizontal parallax remains, with much less vertical float and no rotating image cards.

Latest interaction revision: genealogy occupies a fixed finite world with clamped start/end controls (1/119 and 119/119 verified in browser). Background scenery and foreground have distinct travel rates about the centered genealogy plane. Name groups use relationship-driven normalized depth: direct disciples/current person/mentor in front, unrelated branches behind, still pointer- and keyboard-accessible. Unit/Three tests verify continuous depth promotion and stable world coordinates.

Generation-group revision: each generation is one compact spatial deck. Mouse entry was verified to open another generation without a click; desktop pages show at most six names, short viewports four. The world is no longer widened according to the number of same-generation names. Selected labels are compact horizontal slips to prevent overlap in the two-column deck.
