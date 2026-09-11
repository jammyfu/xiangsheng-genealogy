# Approved immersive design QA

Reference: docs/design/immersive-approved.webp
Implementation: InkWorld, SpatialTree, TimelineJourney
Date: 2026-09-11

final result: blocked

The approved reference was inspected. The desktop cloud browser was opened and functional interactions were exercised. WebGL initialization remains unavailable in that browser; the implementation explicitly reports simplified preview. A same-state GPU screenshot comparison therefore cannot be completed and visual fidelity must not be declared passed.

Checked: timeline navigation/detail/source consistency; switch back to existing SVG genealogy; desktop horizontal overflow absent. 125 unit/DOM/Three.js structure tests pass. Production build passes.

Outstanding:
- P1: Actual WebGL visual comparison for timeline and genealogy, including camera framing, label overlaps, alpha sorting and atmospheric composition.
- P2: Light fringe on generated mountain silhouettes remains; attempted replacement lacked alpha and was rejected.
- P2: Panorama seam, touch devices, and GPU frame rate require supported browser checks.
- Fidelity gaps: generated historical portraits were intentionally not shipped as factual photos; interactive inset minimap is not implemented. Existing fit/reset/zoom remain available.

No deployment or merge was performed. Branch contains reviewable implementation, not a certified visual match.
