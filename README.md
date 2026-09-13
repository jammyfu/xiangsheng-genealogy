<p align="center">中文 | <a href="README.en.md">English</a></p>

# 相声家谱 · Xiangsheng Genealogy

**Xiangsheng Genealogy** is an open-source, source-aware atlas of Chinese
crosstalk (相声) master–disciple lineages. It turns people, relationships,
generation names, and their supporting records into an explorable ink-wash
landscape and a luminous, spatial genealogy.

相声家谱把有出处的师承做成可以阅读、检索和比对的交互图谱：人是节点，师傅到弟子的关系是连线；资料的确认、争议与待考状态会保留在数据和人物信息中。字辈只使用 **德、寿、宝、文、明**，不使用“德寿喜哈”。

![山水长卷：分层景物、人物名牌与主线关系](docs/qa/layered-scroll-fullscreen.png)

## 两种阅读场景

| 山水长卷 | 世代谱系 |
| --- | --- |
| ![山水长卷界面](docs/qa/continuous-scroll-fullscreen.png) | ![选中主脉络的世代谱系](docs/qa/force-tree-selected-lineage.png) |
| 以横向画卷展开人物关系。远山、水面、桥屋和前景景物分层移动，人物名牌置于景深中。 | 以三维星云和星点呈现世代关系。选中人物后，主脉络、上下游关系和连接线保持清晰可读。 |

### 山水长卷

- **连续画卷与全屏自适应**：画面随窗口尺寸铺展；名字和背景遵循不同的运动层，保持阅读焦点。
- **有层次的视差**：远山、岸线、屋桥、水面、近景器物和人物标签使用不同位移与缩放，横向浏览与上下指针移动都能感到空间深度。
- **水面与行船**：水纹以低成本循环流动；船只沿画卷坐标前进，速度由整体画面位置换算，避免与人物尺度失配。
- **可读的人名簇**：按世代形成竖向、立体的名字簇，而不是一长排平铺；主分支在前，旁支退至后方但仍可悬停和点击。
- **关系强调**：选中人物时，其师承链路使用朱砂色前置线条；悬停旁支可临时提升对应名牌和关系线，便于对照。

![前景连线、姓名底牌与悬停状态](docs/qa/foreground-line-hover.png)

### 世代谱系 · 群星璀璨

- **星云背景**：半透明的青蓝、紫灰星云、粒子和微光组成深空底板，让谱系成为可阅读的“群星”而非一张静态图。
- **立体世代关系**：主线沿前景展开，非主线在后方缩小并保留可点击区域；师徒连线随着节点状态高亮。
- **点击与悬停**：点击人物会维持当前主脉络的选中状态；悬停人物会显示其关系范围和视觉反馈，便于在密集谱系中比较。
- **镜头操作**：拖拽旋转，滚轮缩放；界面为键盘与触屏提供相应的可访问路径，并根据 `prefers-reduced-motion` 降低动态效果。

![世代分区与选中谱系](docs/qa/generation-decks.png)

## 主要功能

- React、Vite、TypeScript、React Three Fiber、Drei、Three.js 和 `3d-force-graph`
- 宣纸、水墨、朱砂的视觉系统，搭配 Noto Serif SC 和马善政书法字体
- 深链接人物页：`/p/:id`，并支持画卷、世代谱系、时间线和书页等阅读视图
- 搜索与德 / 寿 / 宝 / 文 / 明字辈筛选
- 人物笺呈现小传、字辈、代表作品、关系说明与资料出处
- 移动端 SVG / DOM 回退，保证非 WebGL 环境也能阅读核心内容
- 机器可读的 JSON 数据、关系边、事件、来源与 Schema

## 如何浏览

1. 从首页或任意人物的深链接进入，例如 `/p/hou-baolin?view=tree`。
2. 在**世代谱系**中点击一个人物，查看其主脉络；拖拽和缩放可检查后方的旁支。
3. 把指针放到名字或节点上，比较该人物相关的师承范围；点击关系卡或节点可切换焦点。
4. 在**山水长卷**中左右浏览。名字与背景保持相对稳定，前景、远景与水面按不同速度运动。
5. 用搜索和字辈筛选收敛结果；筛选不会删除原始师承数据，只改变当前阅读范围。

## 数据与史料原则

数据目录是项目的唯一维护来源。每个人物至少关联一条资料来源；关系、事件和组织状态独立表达，避免用一个标签覆盖不同事实。

| 内容 | 路径 | 说明 |
| --- | --- | --- |
| 人物 | `data/people/*.json` | 姓名、别名、字辈、小传、作品和来源 |
| 师承关系 | `data/edges.json` | 师傅 → 弟子关系及争议标记 |
| 来源 | `data/sources.json` | 报道、馆藏、机构页面与许可信息 |
| 生平与组织事件 | `data/events.json` | 事件和时间线，避免删除历史关系 |
| Schema | `data/schemas/` | 结构约束与校验规则 |

录入时区分“正式师徒”“口盟/学员”“家传”“争议关系”“清门或退出”等不同情况。未能充分核验的师承关系标记为 `"disputed": true`，并保留来源与说明，而不是把不确定信息伪装成结论。扩展资料的核查过程见 [2026-09-12 师承审计](docs/lineage-audit-2026-09-12.md) 和 [数据覆盖说明](docs/data-coverage.md)。

## 本地启动

```bash
npm install
npm run dev
```

默认 Vite 开发服务器会打印本地访问地址。生产构建与预览：

```bash
npm run build
npm run preview
```

运行完整的单元与数据校验：

```bash
npm test
npm run lint
```

## 维护数据

编辑 `data/` 下的维护目录，不要用历史 seed 覆盖现有目录。每次调整人物、关系或事件后，运行测试与构建；新主张应带上来源，存在分歧时应该明确记录分歧。

原始 seed 只保留作历史参考。若需要导出供人工核对的副本，可运行：

```bash
node scripts/emit-seed.mjs
node scripts/emit-seed.mjs --out /tmp/xiangsheng-seed-review
```

导出器只写入新的空目录，拒绝写入 `data/` 或覆盖既有目录。

## 项目文档

- [效果规划与验收路线](docs/next-development-roadmap.md)
- [空间长卷设计与 QA](docs/spatial-scroll-qa.md)
- [连续长卷说明](docs/continuous-scroll.md)
- [资料首批研究记录](docs/research-first-batch.md)
- [贡献指南](CONTRIBUTING.md)
- [机器可读项目摘要](llms.txt)

## 许可与署名

- 源码：[MIT](LICENSE)
- 数据与素材说明：[NOTICE](NOTICE)、[ATTRIBUTION.md](ATTRIBUTION.md)
- 维基百科衍生表格遵循 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

本仓库不托管音频；人物形象使用占位印、公有领域素材或外链，具体来源以数据与署名文件为准。
