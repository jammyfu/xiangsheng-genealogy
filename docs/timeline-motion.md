# 时间回廊与分支动效 · 2026-09-11

## 参考与取舍

- [Tiki-Toki 官方介绍](https://www.tiki-toki.com/)：3D 时间浏览、缩放和点选事件查看详情。本项目采用当前事件居中、相邻事件退入纵深的阅读方式，保留完整列表。
- [3D Force Graph 分支示例源码](https://github.com/vasturiano/3d-force-graph/blob/master/example/expandable-nodes/index.html)：按父子关系裁剪可见分支。借鉴逐级展开，不采用随机力场布局及持续粒子，以保持姓名位置稳定。
- [3D Force Graph 聚焦源码](https://github.com/vasturiano/3d-force-graph/blob/master/example/click-to-focus/index.html)：镜头趋近所选节点。本项目将时间事件切换限制在 650ms，并允许连续操作打断。

## 实现

时间回廊采用 CSS perspective / translateZ / rotateY 与 GSAP（不是新增 WebGL 场景）；原长卷仍由 Three.js 渲染。当前事件正面居中，相邻事件退后，最多两侧各两张可交互。前后按钮、原生键盘滑杆、事件点选与列表切换同时可用。范围或类型变化重新定位；空数据继续提供原有提示与清除筛选。

每次移动 650ms、power3.inOut；快速操作取消旧动画并保留当前姿态。减少动态效果时直接显示当前事件。页面进入后台立即完成过渡。无自动播放、无滚轮劫持。

长卷师承线通过 Three.js BufferGeometry.drawRange 在 550ms 内沿师傅到徒弟方向展开；暂停时立即完整显示，卸载取消动画。争议虚线保持原样。

所有事件沿用现有日期精度、证据状态、不同说法和来源。回廊按事件序号排布，界面明确说明间距不代表历史时长。没有新增未经核验的历史记录。

## 验证

- 120 项自动测试通过；TypeScript 与生产构建通过。
- 新增当前事件位置、快速连续导航及详情一致性、空/单事件边界测试。
- 云浏览器检查全部纪事回廊、前后切换、列表切换和依据展开；检查修复前后卡片遮挡。
- 云浏览器禁用 WebGL，Three.js 分支动画真实 GPU 视觉验收仍待支持 WebGL 的浏览器；现有场景结构测试通过。
- 窄屏有专用卡片尺寸，移动设备实机验收仍待进行。
