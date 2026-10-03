# 2026-10-03 交互审计与两批实现

本次在 Mac mini 的 Codex 内置浏览器实际运行、操作并截图。原仓库 `/Users/jammyfu/works/AI/PersonalProject/xiangsheng-genealogy` 为 main，仅有未跟踪 `.playwright-mcp/`；保留未动。实现位于独立本地副本 `/Users/jammyfu/Documents/Codex/2026-10-03/task/xiangsheng-genealogy`，分支 `ux/core-navigation-20261003`，起点 `45a3c6a`。未发布、合并、部署。

## 按严重度排序的发现与验收

|严重度|实际发现|实现与验收|
|---|---|---|
|P1|搜索郭德纲后点侯耀文，旧搜索仍约束新人物师承；当前与检索对象混淆（01、02）|选人清除完成的 query；明确字辈仍保留；筛选栏说明匹配数、空结果、当前人物保留的原因；重置一次恢复完整范围（07）|
|P1|连续上溯后无人物返回入口；跨阅法后难找来路|人物导航保存最多12步来路；返回恢复上一人物及其 URL 阅法/筛选状态；阅法切换不丢来路（05）|
|P1|390px 人物说明、移卷、操作说明重叠，缩放与字辈区域易混淆（02）|姓名布局为底部控件留空间；移卷、说明/缩放、字辈分别有区域；关键操作44px；390px body.scrollWidth=390；控件边界无交叠（06）|
|P1|关闭弹层时 inert 尚未解除，焦点恢复失败|在关闭渲染完成后恢复显式 opener；寻人自动聚焦检索框；Tab/Shift+Tab留在弹层；Escape回到寻人|
|P2|搜索仅Enter选第一人，缺少方向键结果选择|combobox/listbox、active descendant、上下键、Enter、Escape；中文输入组合期间不触发选人；失焦收起；超9结果可进入带查询的索引（04）|
|P2|切换人物沿用摘要旧滚动位置，姓名被藏住|新人物将摘要scrollTop重置到0（05）；回归测试覆盖|
|P2|重复点击当前阅法增加重复历史|同阅法不再触发navigate；点当前人物也不制造多余人物来路|

保留宣纸、水墨、朱砂、三维长卷及星空谱系方向。当前 AtlasNode 有 dimmed 且类型检查通过，历史故障不复现，没有重复修复。

## 本次流程步骤

1. 进入侯宝林长卷：视觉方向保持；等待异步场景完成后截图。基础浏览通过。
2. 搜索郭德纲/侯：结果可见；键盘选中有朱砂反馈；完成搜索清 query。通过。
3. 郭德纲→侯耀文与侯宝林→朱阔泉：选中人物/摘要更新，返回恢复来路。通过。
4. 山水长卷→世代谱系→人物书笺→返回：同一人物与来路保持。桌面/390px通过。
5. 寻人打开、检索、Tab/Shift+Tab循环、Escape关闭：初始焦点、背景inert、恢复焦点通过。
6. 字辈筛选/不存在的人物：匹配数、当前人物保留说明、空结果、重置反馈通过。
7. reduced-motion：媒体偏好模拟下“静止阅读”禁用，切换状态settled，查人与返回仍工作。通过。

## 验证记录

- 第一批提交 `6b5a2f3`：npm run lint 通过；npm test 31文件/219项通过；npm run build通过。
- 第二批最终：npm run lint（项目定义为 tsc -b）通过；npm test 31文件/220项通过；npm run build通过。日志见 tests-final.log、build-final.log。
- 构建已有大chunk警告，测试有Three.js重复实例warning；没有失败测试。
- 桌面1280×720/1280×900、窄屏390×844；搜索上下键/Enter/Escape、索引关闭/Tab循环、连续人物返回/跨视图、同阅法重复点击均已实际操作。
- 触屏注入：未运行成功。内置浏览器支持触摸模拟设置，但 Input.dispatchTouchEvent 不支持；不能把窄屏/鼠标操作视为真实触屏通过。临时触摸与reduced-motion设置已清除。
- 未做：真实iOS/Android触屏、屏幕阅读器朗读、全面对比所有师承/所有浏览器、原生全屏完整验证。

## 截图

所有截图来自本次浏览器实测，保存后已逐一查看接受。

![改前桌面搜索](01-before-search.jpg)
![改前窄屏师承](02-before-mobile.jpg)
![改后窄屏师承：同一人物，查询已完成](06-after-mobile-lineage.jpg)
![改后键盘选择](04-after-keyboard-search.jpg)
![改后桌面来路与人物摘要](05-after-desktop-lineage.jpg)
![空结果与减少动态效果](07-filter-empty-reduced-motion.jpg)

## 下一批优先项

- P1：三维谱系窄屏仍会形成密集星点/远处标签，宜让关系名册与当前人物师父/弟子列表承担主要追溯路径，三维场景做可选空间探索；本次没有重新设计它。
- P1：真触屏设备点选、拖动误触、缩放手势与页面滚动冲突还需验证；桌面键盘和44px控件只能降低风险。
- P2：来路目前在router location.state中，刷新后会丢失（浏览器会话历史可能保留），不同入口跨会话连续阅读还需产品取舍。
- P2：选中人物/旁支的调色和缩放在三维密集场景中的区分仍需专门检查；不会仅凭截图声称全面无障碍达标。

## 启动

已通过共享端口注册表为该副本分配 HOST=127.0.0.1、PORT=4311。当前 Vite 入口 http://127.0.0.1:4311/。

依赖从原仓库本机 node_modules 复制，未修改锁文件。重启时按工作区端口规范先运行 portctl.py check，取得该目录的 worktree-frontend env，随后 npm run dev -- --host "$HOST" --port "$PORT" --strictPort。
