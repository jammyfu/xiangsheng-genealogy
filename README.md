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
| Life events | `data/events.json` |
| Schemas | `data/schemas/` |

The files under `data/` are the maintained catalog and the source of truth for
the app. Update those files directly when correcting a person or relationship,
adding a source, or recording a life event. Keep each claim tied to its sources;
use named, sourced perspectives for attributed or disputed event accounts.
Record organization departures, expulsions, and performance suspensions as
distinct events without deleting historical teacher links.

Validate catalog changes before committing:

```bash
npm test
npm run build
```

The original seed is retained only as a historical reference fixture. It lacks
later corrections, people, events, and source additions, so it must not replace
the maintained catalog. The exporter writes `people/` and `edges.json` into a
new system temporary directory and prints its location:

```bash
node scripts/emit-seed.mjs
```

To choose the export location, provide a new directory outside `data/` whose
parent already exists:

```bash
node scripts/emit-seed.mjs --out /tmp/xiangsheng-seed-review
```

The script refuses existing output directories and destinations inside `data/`,
including paths through symlinks. It never regenerates or clears the curated
catalog. Review historical exports separately; apply source-checked corrections
to the maintained files individually.

Every person cites at least one source. Unsettled teacher links are
`"disputed": true`.

## License

- Source code: [MIT](LICENSE)
- Dataset notices: [NOTICE](NOTICE), [ATTRIBUTION.md](ATTRIBUTION.md)
- Wikipedia-derived tables remain [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Machine-readable summary:
[llms.txt](llms.txt).
