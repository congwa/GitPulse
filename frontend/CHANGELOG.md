# Changelog

## [0.3.1] - 2026-02-11

### Fixed
- 修复工贼检测分析结果为空的致命问题：stream 默认使用 updates 模式导致 chunk.messages 始终为 undefined，改为 values 模式
- 修复 SubAgent 达到模型调用限制时已收集的 git 数据全部丢失的问题，新增中间数据恢复机制
- 修复 git-forensics SubAgent 反复执行无效 awk/sort 命令浪费模型调用次数的问题

### Changed
- SubAgent 模型调用限制从 20 降至 12，减少无效重复命令
- 优化 git-forensics 提示词，严格禁止 awk/sort 二次处理，要求直接阅读 git 原始输出
- 优化 Orchestrator 调度原则，对 SubAgent 降级结果（含原始数据）的处理更明确

## [0.3.0] - 2026-02-11

### Added
- 工贼检测新增实时活动流（Activity Feed），分析过程中展示 Agent 派遣、git 命令执行、完成/失败等实时动态
- 新增活动通道（activity-channel）轻量 pub/sub 机制，连接 DeepAgent 后端与前端 UI
- 分析进度卡片新增统计标签（Agent 完成数、命令执行次数、事件数）

### Fixed
- 修复 SubAgent 因 recursionLimit=100 过低触发 GraphRecursionError 的问题，调整为 150 并优化 middleware 限制比例
- 新增 SubAgent 90 秒超时保护，防止单个 Agent 无限执行
- SubAgent 达到执行限制时优雅降级，返回提示而非裸错误，避免 Orchestrator 重试死循环

### Changed
- 优化 git-forensics SubAgent 提示词，新增"效率优先原则"减少不必要的 tool call
- 优化 Orchestrator 调度原则，限制总 task 数量（最多 4-5 个），SubAgent 失败时不重试

## [0.2.2] - 2026-02-11

### Changed
- 团队全景页、成员画像页切换为数据库驱动，移除硬编码 mock 数据依赖

## [0.2.1] - 2026-02-11

### Changed
- 模块分析页、AI 洞察页、设置页切换为数据库驱动，移除硬编码 mock 数据
- 设置页缓存大小显示真实数据库体积，清除缓存按钮调用 resetDB 后刷新页面

## [0.2.0] - 2026-02-11

### Added
- 新增 Home 首页（项目选择页：拖放区 + 最近项目列表 + 装饰性背景）
- 新增 Analysis 分析进度页（8 阶段模拟进度 + AI 流式文本 + 跳过按钮）
- 新增 Dashboard 仪表盘页面（Bento Grid 布局：统计卡片 + 提交趋势 + 类型分布 + 活跃时段热力图 + AI 洞察摘要）
- 新增团队全景页（堆叠面积图、雷达图、成员排行表、AI 洞察）
- 新增成员画像页（个人资料头、52 周热力图、提交类型饼图、模块柱状图、提交时间线、AI 画像）
- 新增模块分析页（Treemap 归属地图、模块详情表、AI 洞察）
- 新增 AI 洞察页（分类筛选、洞察卡片网格、AI 对话、报告导出按钮）
- 新增设置页（AI 配置、分析配置、外观设置、数据管理）

## [0.1.0] - 2026-02-11

### Added
- 新增 StatCard 统计卡片组件（数值展示 + 趋势箭头）
- 新增 AIInsightCard AI 洞察卡片组件（default/portrait 两种变体）
- 新增 PageHeader 页面标题组件（图标 + 标题 + 右侧插槽）
- 新增 Tag 标签组件（5 种颜色变体：primary/secondary/accent/danger/muted）
- 新增 ProgressBar 进度条组件（渐变填充 + 弹性缓动动画）
- 新增 TimeRangeSelector 时间范围选择器组件
