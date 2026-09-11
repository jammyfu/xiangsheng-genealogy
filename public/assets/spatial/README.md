# Watercolor spatial assets

Generated with built-in Image Gen on 2026-09-11, using the approved dual-screen design (docs/design/immersive-approved.webp) as visual reference. No generated historical portraits or unverified event text are used as factual content.

- ink-mountains.webp: 2172 × 724 RGBA. Pale ink mountains and pines with real alpha. Converted from generated PNG using FFmpeg libwebp quality 88. Texture is distributed over separate Three.js planes with depthWrite=false and alphaTest=0.025. Some pale edge pixels remain; two regeneration attempts did not preserve alpha and were rejected.
- ink-sky.webp: 1774 × 887, 2:1 panorama. Pale ivory/blue-grey clouds, no ground objects. FFmpeg libwebp quality 90. Mapped onto the inside of a Three.js sphere with depthWrite=false. Left-right seam visually approximated, not a mathematically seamless cubemap or HDR environment map.

Generated raster scenery is an illustration. Scene geometry, genealogy connections and labels remain runtime data. Alpha-plane mountains provide layered depth; they are not full terrain meshes.
