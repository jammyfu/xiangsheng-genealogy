# 新增资料盘点（2026-10-03）

基线：e1e12c7；338人物、338正式师承/争议谱表边、59来源。已完成的交互改动保留，不修改UI。

候选缺漏：田立禾、邢文昭、王文林、魏文亮、孟凡贵、李建华、高晓攀、尤宪超、范伟/陈连仲。魏龙豪和陈逸安也未收录；魏龙豪Wikipedia明确“无师承”，不添加陈逸安→魏龙豪，不把吴兆南搭档转成师承。

已有边：张寿臣→刘宝瑞/常宝堃、常宝堃→苏文茂、侯宝林→吴兆南/师胜杰。多数仅种子谱表出处，适合独立补证。

已有争议：张三禄→朱绍文/阿彦涛/沈春和；朱阔泉→马志明。侯耀文已有赵佩茹师承边，需要区分正式仪式与授艺/指导。

结构：每人data/people/<id>.json；data/edges.json；data/sources.json。Person字段id/name/nameHant/aliases/generation/generationIndex/birthYear/deathYear/floruit/school/bio/works/sources/portraitKind/disputed/notes。无独立籍贯字段，事实可进入简介或备注。Edge只有mentor，支持disputed/note；不以关系覆盖率制造边。Source支持URL、publisher、accessed与note；按事实记录核验范围，不复制百科长段正文。

检索记录：已实际搜索Wikipedia、Baidu Baike、Grokipedia。Grokipedia域名检索未找到对应候选词条，其首页web打开报不可重试错误；这不能证明词条不存在。Baidu域名检索和“田立禾/邢文昭 百度百科”检索未返回可核验词条URL，待并行研究补充；不使用其他百科冒充百度。Wikipedia田立禾/吴兆南/魏龙豪正文已打开；邢文昭中文标题返回404，使用德云社公告和新京报报道补证。

吴兆南种子出生年1929存在风险：Wikipedia为1926，2015年台湾光华采访文本为1925，不能单凭年龄反推出生年或擅自消除异说，需在核验中保留差异。

完成结果见 report.md：348人物、344关系、73出处。吴兆南出生年另与已读中央社1924年说冲突，保留待考。百度摘要与Grokipedia安全拒绝未提升为已读全文。
