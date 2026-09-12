<p align="center">中文 | <a href="README.en.md">English</a></p>

<div align="center">
  <img src="public/seal.svg" alt="相声家谱印章" width="96">
  <h1>相声家谱（Xiangsheng Genealogy）</h1>
  <p><strong>开源水墨三维图谱，画出相声有出处的师承</strong></p>
  <p>
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19">
    <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" alt="Vite">
    <img src="https://img.shields.io/badge/Three.js-r180-000000?logo=threedotjs&logoColor=white" alt="Three.js">
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/License-MIT-2d6a4f" alt="MIT">
  </p>
</div>

---

## 一句话定位

**相声家谱（Xiangsheng Genealogy）是开源水墨三维图谱：把有出处的相声师承画成可检索的图。墨点是人，墨线是师傅→弟子。**

> 字辈只用 **德寿宝文明**（德 / 寿 / 宝 / 文 / 明），不用「德寿喜哈」。本库不托管音频；画像只用占位印、公有领域或外链。

## 截图

<div align="center">
  <img src="docs/studio-desktop.png" alt="桌面端水墨师承图与人物笺" width="720">
  <p><em>既有工作室截图（桌面）。当前打开默认为侯宝林，不是分步游径。</em></p>
  <img src="docs/studio-mobile.png" alt="窄屏水墨师承图" width="360">
  <p><em>既有工作室截图（窄屏）。窄屏仍走 WebGL 长卷；平面 SVG 只在 WebGL 失败或手动切换时出现。</em></p>
</div>

更多画面见 [docs/README.md](docs/README.md)。

## 核心功能

| 模块 | 能力 |
| --- | --- |
| **三维师承图** | 墨点是人，墨线是师傅→弟子；选中后镜头对准人物 |
| **人物笺** | 小传、字辈、作品**标题**、出处；不播放、不提供音频下载 |
| **默认打开** | `/` 转到 `/p/hou-baolin`（侯宝林）。图上会展开其师承上下文（含朱阔泉、马季等），但没有分步「游径」控件 |
| **一脉选择** | 下拉换根：侯宝林、马三立、郭德纲、刘宝瑞、常宝堃 |
| **检索与字辈** | 姓名 / 艺名 / id；德 / 寿 / 宝 / 文 / 明 过滤 |
| **平面回退** | 长卷在 WebGL 不可用时改用 SVG 平面谱系；世代谱系可手动「切换平面谱系」。不是按窄屏自动切换 |
| **深链接** | `/p/:id` |
| **开源数据** | `data/people/*.json`、`data/edges.json`、`data/sources.json`、`data/events.json` 与 JSON Schema |

界面另有山水长卷、世代谱系、人物书笺、生平年表等浏览视图。当前 GPU 对稿仍受环境限制，合并不代表设计稿复刻已通过验收。后续阶段见 [开发路线](docs/next-development-roadmap.md)。

## 技术栈

```
┌──────────────────────────────────────────────────────────────┐
│  App（Vite）                                                 │
│  ├── React 19 + TypeScript                                   │
│  ├── React Three Fiber + Drei + Three.js                     │
│  ├── GSAP                                                    │
│  ├── react-router-dom（深链接 /p/:id）                        │
│  ├── Phosphor icons                                          │
│  └── 字体：Noto Serif SC / Ma Shan Zheng                     │
├──────────────────────────────────────────────────────────────┤
│  Data                                                        │
│  └── data/people · edges.json · sources.json · events.json   │
└──────────────────────────────────────────────────────────────┘
```

界面用宣纸色 `#F3EBD9`、墨灰、朱砂印 `#8B1E1E`。

## 快速开始

需要 Node.js 与 npm。本仓库 CI 使用 Node 22。

```bash
git clone https://github.com/jammyfu/xiangsheng-genealogy.git
cd xiangsheng-genealogy
npm install
npm test          # vitest
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## 数据

当前目录（会随提交增减）：`data/people/` **119** 份人物 JSON，另有 105 条师承、25 条来源、11 条正式事件。数字只表示已收录范围，不表示全量核验或完整名录。详见 [数据覆盖说明](docs/data-coverage.md)。

| 类型 | 路径 |
| --- | --- |
| 人物 | `data/people/*.json` |
| 师承 | `data/edges.json` |
| 出处 | `data/sources.json` |
| 生平事件 | `data/events.json` |
| Schema | `data/schemas/` |

`data/` 是应用的维护目录与事实来源。改正人物或关系、补出处、记事件，都直接改这些文件。每条说法绑来源；有争议或归因说法用具名、有出处的视角。退社、除名、停演记为独立事件，不删历史师承边。

提交前校验：

```bash
npm test
npm run build
```

每人至少一条出处。未定师承标 `"disputed": true`。字辈仅 德 / 寿 / 宝 / 文 / 明；第 1–3 代与第 9 代及以后可为 `null`。作品只记标题。

原始 seed 只作历史对照，缺后续更正，不能替换维护目录。导出脚本把 `people/` 与 `edges.json` 写到新的系统临时目录并打印路径：

```bash
node scripts/emit-seed.mjs
```

指定目录时，父目录须已存在，且目标不能落在 `data/` 内：

```bash
node scripts/emit-seed.mjs --out /tmp/xiangsheng-seed-review
```

脚本拒绝已存在的输出目录，以及经符号链接指向 `data/` 的路径。它不重写、不清空维护目录。历史导出单独审阅；经出处核对的更正逐条写回维护文件。

## 许可

- 源码：[MIT](LICENSE)
- 数据说明：[NOTICE](NOTICE)、[ATTRIBUTION.md](ATTRIBUTION.md)
- 源自维基百科的表格仍为 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。机器可读摘要：[llms.txt](llms.txt)。英文说明：[README.en.md](README.en.md)。

这是研究可视化，不是排辈法庭。优先已刊表格，不收传闻。

---

<div align="center">
  <sub>相声家谱 · Xiangsheng Genealogy · MIT</sub>
</div>
