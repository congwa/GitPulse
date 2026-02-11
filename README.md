# GitPulse — 用数据讲述团队的代码故事

![GitPulse Dashboard](http://qiniu.biomed168.com/pic/dashboard.png)

GitPulse 是一款基于 Tauri + React 的桌面应用，通过解析 Git 仓库历史记录，结合 AI 智能分析，为开发团队提供全方位的代码贡献洞察、团队协作诊断和代码质量评估。

## 核心功能

### 仪表盘

![仪表盘](http://qiniu.biomed168.com/pic/dashboard.png)

项目全局概览，自动展示关键指标：总提交数、活跃成员、代码行数、涉及文件数。包含提交趋势折线图、提交类型分布饼图、活跃时段热力图（7×24），以及 AI 自动生成的项目概况总结。

### 团队全景

![团队全景](http://qiniu.biomed168.com/pic/role.png)

成员贡献排行、能力雷达图、贡献趋势对比。支持按时间范围筛选，一目了然地看到谁是核心贡献者、谁的活跃度在下降。AI 自动生成团队洞察，包含风险预警、亮点发现和优化建议。

### 成员画像

点击任意成员进入个人画像页面，展示：
- 52 周 GitHub 风格贡献热力图
- 提交类型分布（feat / fix / refactor / style...）
- 活跃模块排行
- AI 生成的个性化成员标签和画像描述

### 模块分析

![模块分析](http://qiniu.biomed168.com/pic/module.png)

以树状图展示代码模块归属关系，直观呈现每个模块的所有者、提交热度和协作情况。帮助识别"知识孤岛"和巴士因子风险。

### AI 洞察

分类展示 AI 发现的所有洞察（风险 / 亮点 / 趋势 / 建议），支持与 AI 自由对话提问，并可一键生成专业分析报告。

### 工贼检测中心

基于 DeepAgent 多级 Agent 架构的深度分析功能，自动检测 7 种代码无用功模式：

| 模式 | 说明 |
|------|------|
| W1 代码蒸发 | 新增大量代码后被大面积删除 |
| W2 反复重写 | 同一文件短期内被反复大改 |
| W3 闪电回滚 | 提交后立即 revert |
| W4 先堆后拆 | 先堆砌功能再拆分重构 |
| W5 破坏性简化 | 删除有效代码导致功能退化 |
| W6 碎片化修复 | 同一问题反复小修补 |
| W7 重复劳动 | 多人做相同的事 |

分析流程：SQLite 快速预扫描 → DeepAgent 多级 Agent 协作（Git 取证官 / 代码考古师 / 模式侦探）→ 生成浪费评分和改进建议。

### 异常检测

自动检测三类异常：
- **巴士因子**：识别仅由单人维护的关键模块
- **节奏突变**：检测提交频率的异常波动
- **活跃度变化**：跟踪成员参与度的上升或下降趋势

## AI 能力

GitPulse 深度集成 LLM 能力，所有 AI 功能均通过 LangChain Agent 实现工具调用，确保分析基于真实数据而非凭空生成。

**支持的 AI 服务商**：OpenAI / Anthropic / DeepSeek / SiliconFlow / OpenRouter / Groq / Together / Fireworks / 自定义兼容 API

**AI 功能矩阵**：

| 功能 | 类型 | 说明 |
|------|------|------|
| 仪表盘摘要 | 结构化输出 | 项目概况一句话总结 + 关键指标亮点 |
| 团队洞察 | 结构化输出 | 3-5 条洞察 + 团队健康度评分 |
| 异常检测 | 结构化输出 | 异常列表 + 严重程度 + 建议 |
| 成员标签 | 结构化输出 | 自动为成员生成角色标签 |
| 成员画像 | 流式输出 | AI 生成的个性化画像描述 |
| AI 对话 | 流式输出 | 基于项目数据的自由问答 |
| 报告生成 | 流式输出 | 生成 Markdown 格式的完整分析报告 |
| 工贼检测 | DeepAgent | 多级 Agent 协作的深度代码分析 |

## 技术栈

```
前端        React 19 · TypeScript 5.9 · Vite 7 · Tailwind CSS 4
状态管理    Zustand 5（persist 中间件）
图表        ECharts 6
AI/LLM     LangChain 1.2 · @langchain/openai · @langchain/anthropic
数据库      sql.js（SQLite WASM，持久化到 IndexedDB）
桌面框架    Tauri 2
后端        Rust（Git 操作 + 安全命令执行）
```

## 数据架构

```
┌─────────────────────────────────────────────────┐
│                   SQLite (sql.js)                │
├─────────────┬───────────────┬───────────────────┤
│  原始数据层  │   聚合统计层   │    AI 分析层      │
│             │               │                   │
│ raw_commits │ stats_by_*    │ ai_results        │
│             │ file_hotspots │ waste_events      │
│             │ module_owner  │ waste_scores      │
│             │ heatmap       │ waste_runs        │
│             │ collab_edges  │                   │
└─────────────┴───────────────┴───────────────────┘
         │              ↑               ↑
         ▼              │               │
    Git Log 解析 ──→ 数据聚合 ──→ AI Agent 分析
```

## 安全设计

Tauri 后端对 DeepAgent 的命令执行实施严格安全控制：

- **命令白名单**：仅允许 `git`、`rg`、`grep`、`find`、`wc`、`head`、`tail` 等只读命令
- **危险操作拦截**：禁止 `rm`、`mv`、`cp`、`git push`、`git reset --hard` 等破坏性操作
- **路径遍历防护**：所有文件操作限制在仓库目录内，防止路径穿越攻击

## 项目结构

```
shirehub_studio_web_demo/
├── frontend/
│   └── src/
│       ├── pages/          # 9 个页面
│       │   ├── home/       #   首页（仓库选择）
│       │   ├── analysis/   #   分析管线
│       │   ├── dashboard/  #   仪表盘
│       │   ├── team/       #   团队全景
│       │   ├── member/     #   成员画像
│       │   ├── modules/    #   模块分析
│       │   ├── insights/   #   AI 洞察
│       │   ├── waste/      #   工贼检测
│       │   └── settings/   #   设置
│       ├── components/     # 可复用 UI 组件
│       ├── stores/         # Zustand 状态管理（5 个 store）
│       ├── ai/             # AI 模块
│       │   ├── tasks/      #   AI 任务（7 个）
│       │   ├── tools/      #   Agent 工具（7 个）
│       │   ├── schemas/    #   结构化输出 Schema
│       │   └── deepagent/  #   DeepAgent 深度分析引擎
│       └── lib/
│           ├── database/   #   SQLite 数据库服务
│           └── git/        #   Git 操作服务
└── src-tauri/              # Rust 后端
    └── src/main.rs         #   Tauri 命令（Git 操作 + 安全执行）
```

## 快速开始

![首页](http://qiniu.biomed168.com/pic/home.png)

```bash
# 安装依赖
cd frontend && pnpm install

# 开发模式（Web）
pnpm dev

# 开发模式（Tauri 桌面应用）
pnpm tauri dev

# 构建
pnpm tauri build
```

## 配置 AI

![设置页面](http://qiniu.biomed168.com/pic/setting.png)

首次使用需在设置页面配置 AI 服务商：

1. 打开应用 → 进入「设置」页面
2. 选择 AI 服务商（如 OpenAI、DeepSeek、SiliconFlow 等）
3. 填入 API Key
4. 选择模型（如 gpt-4o、deepseek-chat、GLM-4 等）
5. 返回仪表盘，AI 功能将自动启用

## 应用截图

<details open>
<summary>📸 点击展开/收起应用截图</summary>

### 主要界面

| 首页 | 仪表盘 | 团队全景 |
|------|--------|----------|
| ![首页](http://qiniu.biomed168.com/pic/home.png) | ![仪表盘](http://qiniu.biomed168.com/pic/dashboard.png) | ![团队全景](http://qiniu.biomed168.com/pic/role.png) |

| 模块分析 | 设置页面 | 首次进入 |
|----------|----------|----------|
| ![模块分析](http://qiniu.biomed168.com/pic/module.png) | ![设置页面](http://qiniu.biomed168.com/pic/setting.png) | ![首次进入](http://qiniu.biomed168.com/pic/first-enter.png) |

### 功能展示

| 加载界面 | 检查界面 | 备用界面 |
|----------|----------|----------|
| ![加载界面](http://qiniu.biomed168.com/pic/loading.png) | ![检查界面](http://qiniu.biomed168.com/pic/check.png) | ![备用界面](http://qiniu.biomed168.com/pic/first-enter2.png) |

### 其他界面

| 检查界面2 |
|-----------|
| ![检查界面2](http://qiniu.biomed168.com/pic/check2.png) |

</details>
