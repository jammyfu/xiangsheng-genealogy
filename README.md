# 相声家谱 · Xiangsheng Genealogy

**Xiangsheng Genealogy** is an open-source ink-wash map of Chinese
crosstalk (**相声**, xiangsheng) master–disciple lineages — who taught
whom, which generation name they carried, and where that claim is
written down.

相声家谱以宣纸水墨的方式，把有出处的师承画成可检索的图谱：墨点是人，墨线是师傅→弟子。字辈只用 **德寿宝文明**，不用「德寿喜哈」。

![Studio](docs/studio-desktop.png)

## Features

- React + Vite + TypeScript + React Three Fiber + Drei
- 水墨国画界面：宣纸 `#F3EBD9`、墨灰、朱砂印 `#8B1E1E`、留白、Noto Serif SC
- 三维师承图，镜头飞入；人物笺含小传、字辈、作品标题、出处
- 默认游径：朱阔泉 → 侯宝林 → 马季 → 传人；可选马三立对照
- 检索 + 德 / 寿 / 宝 / 文 / 明 过滤
- 移动端宣纸 SVG 回退
- 深链接 `/p/:id`
- 开源数据：`data/people/*.json`、`data/edges.json`、`data/sources.json` 与 JSON Schema

本库 **不托管音频**。画像只用占位印、公有领域或外链。

## Quick start

```bash
npm install
npm test
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Data

| Kind | Path |
| --- | --- |
| People | `data/people/*.json` |
| Edges | `data/edges.json` |
| Sources | `data/sources.json` |
| Schemas | `data/schemas/` |

Regenerate from the cited seed catalog (optional):

```bash
node scripts/emit-seed.mjs
```

Every person cites at least one source. Unsettled teacher links are
`"disputed": true`.

## License

- Source code: [MIT](LICENSE)
- Dataset notices: [NOTICE](NOTICE), [ATTRIBUTION.md](ATTRIBUTION.md)
- Wikipedia-derived tables remain [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Machine-readable summary:
[llms.txt](llms.txt).
