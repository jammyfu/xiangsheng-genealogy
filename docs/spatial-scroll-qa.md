# Three.js 空间长卷验收记录

本轮按用户补充要求，将山水长卷升级为真实三维场景。其余浏览方式继续使用同一人物、检索条件、字辈和史料。代码实施完成不等于 GPU 视觉验收完成。

## 已实现

- Three.js 透视相机与细分纸面几何；使用已确认的淡墨山水贴图，鼠标左右位置改变卷边曲率，上下位置改变纸面起伏。
- 人物仍按世代和支系排列，空间深度只表达导航层次。透视补偿固定姓名中心，中文名笺朝向相机，悬停抬升且关联线跟随。
- 鼠标聚焦不会提前移开目标；键盘聚焦才主动带回视区。悬停深度不再反向驱动平面位移，消除边缘目标反复进出的风险。
- 总览尺度隐藏过小的分支按钮；在姓名附近点击会按最近支系放大阅读。键盘聚焦同样恢复阅读尺度。移动超过 6px 按拖动处理。
- 支持静止阅读、系统减少动态偏好和可见性切换；只在变化时请求帧。WebGL 创建、初始化和场景错误均有明确二维降级入口。
- 3D 模块按需加载；像素倍率上限 1.5。关系线重用位置与虚线距离缓冲，避免每帧重新分配线段距离数组。

## 验证层次

| 范围 | 验证方式 | 结论 |
| --- | --- | --- |
| 空间函数 | 15 项 Vitest：曲率、投影补偿、深度边界、阻尼、手势 | 通过 |
| 实际 Three 场景图 | 5 项场景测试：真实 PlaneGeometry 顶点变化、Group 投影、Line 跟随、隐藏稳定、静止姿态 | 通过；不包含 GPU 输出 |
| DOM 生命周期与输入 | 7 项 React/jsdom：模拟 GPU 构造和 R3F 初始化，检查初始化失败、StrictMode、暂停、可见性、减少动态、总览选取、拖动排除与静止后重新请求帧 | 通过；不包含真实浏览器命中框布局 |
| 全套工程验证 | 111 项测试、TypeScript、生产构建与变更空白检查；包含人物、师承、事件、来源、可见性与独立视角回归 | 通过；DOM 测试模拟 Three 导入时有重复实例提示 |
| 云端浏览器 | 确认 WebGL 失败后显示说明与可操作图谱；全谱有 119 个姓名按钮；适应全谱显示 30%；选择马季、进入书笺再返回长卷保留人物 | 通过降级路径 |
| 真实 GPU 视觉 | 左右指针画面对照、名笺遮挡、卷面阴影、移动端触摸及帧时间 | **阻塞，待支持 WebGL 的浏览器验收** |

## 环境阻塞与发布边界

当前选定云端浏览器返回 `GL_VENDOR=Disabled`、`GL_RENDERER=Disabled` 和 `Error creating WebGL context`。浏览器提供的能力列表为空，没有可用的 GPU 开关。本轮没有擅自切换浏览器或将二维截图当作三维验收结果。

通过实际 Three.js 场景图测试可证明几何和空间位置在变化；仍不能据此宣称真实渲染的明暗、中文栅格化、遮挡和运动观感已经达到设计稿或 FWA 获奖水平。PR 继续保留为草稿。

3D 模块构建约 652 kB，gzip 约 176 kB，已与主入口分离。Vite 对此模块仍提示超过 500 kB；实际设备帧时间与首次渲染时间尚未测得。增加测试依赖时固定 React/react-dom 为现有锁定版本 19.2.8，避免自动解析到不满足当前 R3F peer 范围的新次版本。

## 设计依据

- [FWA](https://thefwa.com/) 强调数字设计创新；没有将 Three.js 作为获奖硬性条件。本实现把空间交互用于理解师承与选取人物，不保证奖项结果。
- [WCAG 2.2 目标尺寸说明](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)：阅读尺度保留清晰点击区域；全谱总览采用附近支系选取后放大的方式，避免把缩放前 CSS 尺寸误当作实际触控尺寸。
- [键盘可操作性](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)与[交互动画说明](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)：DOM 姓名按钮保留键盘路径，提供减少动态与静止阅读。
- [R3F 按需渲染](https://r3f.docs.pmnd.rs/advanced/scaling-performance)与[性能注意事项](https://r3f.docs.pmnd.rs/advanced/pitfalls)：更新帧使用引用、复用几何，静止时停止请求帧。
- [React Three Test Renderer](https://github.com/pmndrs/react-three-fiber/tree/master/packages/test-renderer)：用于无 GPU 场景图测试，能力边界单独列示。
