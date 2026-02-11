# Page: Member (成员画像 — 个人详情)

> **Route:** `/member/:email`
> **Overrides from MASTER.md:** Profile header style, dense chart layout

---

## Layout

```
┌──────┬──────────────────────────────────────────┐
│      │  Profile Header (个人信息头部)             │
│ Side ├──────────────────────────────────────────┤
│ bar  │                                          │
│      │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│      │  │日均提交│ │存活率 │ │常用语言│ │活跃时段│   │  ← Stat × 4
│      │  └──────┘ └──────┘ └──────┘ └──────┘   │
│      │                                          │
│      │  ┌────────────────────────────────────┐  │
│      │  │ 提交热力图 (52w × 7d)               │  │  ← 4x1
│      │  └────────────────────────────────────┘  │
│      │                                          │
│      │  ┌──────────────────┐ ┌──────────────┐  │
│      │  │ 模块归属树图      │ │ 提交类型环形图│  │  ← 2x1 + 2x1
│      │  └──────────────────┘ └──────────────┘  │
│      │                                          │
│      │  ┌──────────────────┐ ┌──────────────┐  │
│      │  │ 工作节奏时段图    │ │ 技术栈河流图  │  │  ← 2x1 + 2x1
│      │  └──────────────────┘ └──────────────┘  │
│      │                                          │
│      │  ┌────────────────────────────────────┐  │
│      │  │ 最近提交记录 (时间线)               │  │  ← 4x1
│      │  └────────────────────────────────────┘  │
│      │                                          │
│      │  ┌────────────────────────────────────┐  │
│      │  │ AI 个人画像                         │  │  ← 4x1
│      │  └────────────────────────────────────┘  │
│      │                                          │
└──────┴──────────────────────────────────────────┘
```

---

## Components

### Profile Header (Override)

不使用标准 card，而是自定义的横条区域：

```css
.profile-header {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-6);
  background: linear-gradient(
    135deg,
    var(--primary-soft) 0%,
    var(--surface) 60%
  );
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  margin-bottom: var(--space-6);
}

/* Dark mode: gradient from var(--primary-soft dark) */
```

**头像：**
```css
.profile-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 3px solid var(--surface);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  /* Gravatar or 首字母 + Chart 颜色背景 */
}
```

**信息区域：**
- 姓名: `h1`, `var(--text)`
- 邮箱: `body-sm`, `var(--text-muted)`
- 标签行: 1-3 个 AI tags (使用 MASTER `.tag` 组件)
- 统计行: "首次提交: 2024-03-15 | 总提交: 423 | 活跃: 187天"
  - `caption`, `var(--text-secondary)`, 用 `·` 分隔

**成员切换器（右侧）：**
```css
.member-switcher {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.member-switcher-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
}

.member-switcher-btn:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
}
```

- Icon: Lucide `ChevronLeft` / `ChevronRight` (16px)

### Contribution Heatmap (52w × 7d)

GitHub 风格但更软糯：

```
格子: 12px × 12px, gap 3px, radius 3px

Light Mode 渐变 (5 级):
  Level 0: var(--surface)           #FFFFFF (无提交)
  Level 1: #FFE4D4                  很浅橘
  Level 2: #FFD4C4                  浅橘 (primary-soft)
  Level 3: #FFAB8F                  中橘
  Level 4: #FF8C6B                  深橘 (primary)

Dark Mode 渐变 (5 级):
  Level 0: var(--surface)           #2A1F24 (无提交)
  Level 1: #3D2A22
  Level 2: #5C3D33
  Level 3: #8B5842
  Level 4: #FF9E80                  (primary)
```

- 底部月份标签: `caption`, 每月第一周标注
- 左侧星期标签: "一" "三" "五" (隔一个标注)
- 悬浮 Tooltip: "2026-01-15 (周三) — 7 次提交"

### Module Treemap (模块归属)

- 颜色: 此人的 Chart 颜色做主色，深浅表示代码量
- 每块文字: 目录名 + 占比% — `caption`, 白色 (在深色块上)
- border-radius: 每块 4px
- 容器 border-radius: `var(--radius-xl)`
- 点击某块: Tooltip 展开详情（文件数、提交数、最近活跃时间）

### Commit Type Donut

- 与 Dashboard 的环形图规则相同
- 中心文字: 此人总提交数
- 颜色按 commit type 固定:
  - feat: `var(--primary)` 蜜桃橘
  - fix: `var(--danger)` 柔粉红
  - refactor: `var(--secondary)` 薰衣草
  - docs: `var(--accent)` 薄荷绿
  - chore: `var(--text-muted)` 浅灰

### Work Rhythm Heatmap (7×24)

与 Dashboard 热力图相同规范，但是此人的个人数据。
- 高亮此人最活跃时段用更深的颜色

### Tech Stack Stream Graph

- D3 河流图 (StreamGraph)
- X 轴: 月份
- Y 轴: 文件类型占比
- 颜色: 每种文件类型一个柔和色（`.ts` 蓝、`.tsx` 紫、`.css` 粉、`.rs` 橘）
- 填充: opacity 0.7
- 悬浮: 高亮一种文件类型，其他透明度降低

### Recent Commits Timeline

```css
.commit-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
  padding-left: 24px;
}

/* 左侧竖线 */
.commit-timeline::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: var(--border);
  border-radius: 1px;
}

.commit-item {
  position: relative;
  padding: 8px 0 8px 16px;
}

/* 时间线上的圆点 */
.commit-item::before {
  content: '';
  position: absolute;
  left: -20px;
  top: 14px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: var(--surface);
}

/* 按 commit type 着色圆点 */
.commit-item.feat::before { border-color: var(--primary); background: var(--primary-soft); }
.commit-item.fix::before  { border-color: var(--danger); background: #FFE4E6; }
```

**每条记录内容：**
- 时间戳: "2小时前" — `caption`, `var(--text-muted)`
- commit 消息: `body-sm`, `var(--text)`
- commit hash: `code` font, 前7位, `var(--text-muted)`

### AI Portrait Card

比 Dashboard 的 AI 卡片更大，独占一行：

```css
.ai-portrait {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  border-left: 4px solid var(--secondary);
}

.ai-portrait-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  color: var(--secondary);
  font-size: 14px;
  font-weight: 600;
}
/* Icon: Lucide Sparkles (18px) */

.ai-portrait-text {
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-secondary);
}
```

内容为 Markdown 渲染（支持加粗、列表等）。
