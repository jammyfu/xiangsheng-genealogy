# Independent handscroll scenery

Generated on 2026-09-11 using the built-in image generation tool, with the original river-handscroll illustration as the visual reference. These are original style-matched redraws of local subjects, not literal crops of a historic painting.

Each PNG is 1254 × 1254 RGB: mountain, village, bridge, pine, boat, willow. The magenta backing is intentionally retained in these source files; SceneryLayers.tsx applies runtime chroma-key coverage and spill suppression. Do not use the PNGs as ordinary HTML transparent images.

The parent river-handscroll.png is 2172 × 724. Three-dimensional paper geometry is procedural; scenery uses independently positioned textured planes. No historical person likenesses or source claims are encoded into these generated images.

2026-09-11 depth revision: bank.png is an additional 1254 × 1254 RGBA empty bank asset with real transparency. It supports the village shoreline. The current environment is ../river-environment.png (2172 × 724), containing only sky, haze, water and empty low banks; the former complete painting is no longer rendered in ScrollScene.

## 固定长卷构图（2026-09-11）
新增 river-village.png、river-gorge.png、river-garden.png：imagegen 生成的 2172×724 透明宽幅江村、峡谷、水榭画景。源文件依次为 exec-9215e95f-3559-4563-bbd7-dfc56559960a.png、exec-e5086ab3-188a-49be-873c-20a5a68ec871.png、exec-42b98857-c4ca-4f89-8526-d14bde8fc0f0.png。保留源 alpha 与宽高比例；材质剔除饱和彩边。每张素材在整卷固定布局中仅出现一次，旧 village.png 保留归档但不再渲染。
