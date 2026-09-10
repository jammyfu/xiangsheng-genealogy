# Spatial Scroll Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for bounded parallel work and review.

**Goal:** 将已批准淡墨长卷升级为可随鼠标展开、人物具真实纵深的Three.js浏览场景。

**Architecture:** 沿用buildAtlas的数据、可见性和控制器，仅更换scroll渲染器。纯数学负责曲面、透视补偿与运动；R3F负责卷面和关系线，DOM按钮跟随3D投影保证可读与可访问。

**Tech Stack:** Existing React19 / Three.js0.180 / R3F9 / Drei10 / TypeScript / Vitest.

**Spec:** ../specs/2026-09-11-spatial-scroll.md

## Global Constraints
- 淡墨素材与历史数据保持其证据语义，所有新运动是视觉导航行为。
- 画布只在可见且变化时请求帧；减少动态模式不自动移动。
- 继续在codex/ink-atlas-20260910逐阶段提交并同步。

## Task 1: 纯空间数学
- [ ] 新建src/lib/scroll-space.ts及测试。cameraDistance定义38°投影视角；perspectiveAnchor保证静止投影与原布局一致；nodeDepth限制纵深。
- [ ] scrollSurface输出有限曲面和可观察卷边变化；dampValue验证帧率独立，isSelectionGesture以6px区分点击拖动。
- [ ] 运行对应Vitest，审查测试结果。

## Task 2: 长卷渲染与控制器接入
- [ ] 新建ScrollScene.tsx与scroll-scene.css：透视Canvas、细分水墨卷面、3D关系线、真实空间锚定中文按钮。
- [ ] AtlasGraph复用原图谱状态与控件，scroll动态加载新渲染器；tree保留精确谱系阅读。Studio传可见性，避免隐藏时消耗帧。
- [ ] 悬停/聚焦提升名笺，拖动与点击分离，保留展开与来源说明；失效时回退可操作二维图。
- [ ] 运行TypeScript与构建，提交并同步实现里程碑。

## Task 3: 真实浏览器验收
- [ ] 对照左右鼠标位置截图及DOM节点坐标；核对真实canvas、可读标签、分支、搜索、缩放与模式状态。
- [ ] 验证窄屏手势和减少动态模式、闲置帧停止及错误边界；修复具体问题。
- [ ] 更新docs/design-qa.md和progress.md，运行全套测试，提交同步验收结果与PR。
