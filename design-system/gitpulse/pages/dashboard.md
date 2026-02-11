# Page: Dashboard (仪表盘 — 项目全景)

> **Route:** `/dashboard`
> **Overrides from MASTER.md:** Bento grid layout specifics

---

## Layout

```
┌──────┬──────────────────────────────────────────┐
│      │  Header: 页面标题 + 时间范围选择器        │
│      ├──────────────────────────────────────────┤
│ Side │                                          │
│ bar  │  Bento Grid (4 columns)                  │
│      │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│ 220  │  │ Stat │ │ Stat │ │ Stat │ │ Stat │   │  ← 1x1 × 4
│  px  │  │ Card │ │ Card │ │ Card │ │ Card │   │
│      │  └──────┘ └──────┘ └──────┘ └──────┘   │
│      │  ┌──────────────────┐ ┌──────────────┐  │
│      │  │ 提交趋势图        │ │ 类型占比      │  │  ← 3x1 + 1x1
│      │  │ (面积折线图)      │ │ (环形图)      │  │
│      │  │ 2x1              │ │ 1x1          │  │
│      │  └──────────────────┘ └──────────────┘  │
│      │  ┌────────────────────────────────────┐  │
│      │  │ 团队热力图 (7×24)                   │  │  ← 4x1
│      │  │ 4x1                                │  │
│      │  └────────────────────────────────────┘  │
│      │  ┌────────────────────────────────────┐  │
│      │  │ AI 一句话总结                       │  │  ← 4x1
│      │  └────────────────────────────────────┘  │
│      │                                          │
└──────┴──────────────────────────────────────────┘
```

---

## Page Header

```css
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 var(--space-4);
}
```

- Title: Lucide `LayoutDashboard` (20px) + "仪表盘" — `h1`, `var(--text)`
- 时间选择器: `Select` 组件，options: 近1月/3月/6月/1年/全部
  - border-radius: `var(--radius-sm)`
  - 背景: `var(--surface)`

---

## Components

### Stat Cards (Override)

四张卡片等宽排列。每张卡片内部布局：

```
╭───────────────╮
│  icon  label  │   ← caption, var(--text-muted), 图标 16px
│               │
│    1,247      │   ← stat font (32px, mono, var(--text))
│   ↑ 12%      │   ← trend: accent(up) / danger(down), 12px, font-weight 600
╰───────────────╯
```

**四张卡片的 icon + label：**
1. Lucide `GitCommit` + "总提交"
2. Lucide `Users` + "活跃成员"
3. Lucide `FileCode2` + "涉及文件"
4. Lucide `Plus` + Lucide `Minus` + "代码行数" (如 "+45.2K")

**Hover:** 轻微浮起 + border-color 变为对应语义色（增长绿/下降粉）

### Commit Trend Chart (提交趋势)

- 占 3 列宽 (3x1)
- 类型: ECharts 面积折线图
- X 轴: 周标签 ("W1", "W2", ...)
- Y 轴: 提交数量
- 面积填充: `var(--primary)` → 透明渐变 (opacity 0.1)
- 线条: `var(--primary)`, width 2.5, smooth
- 数据点: 圆点, radius 4, 悬浮时 radius 6

### Commit Type Pie (类型占比)

- 占 1 列宽 (1x1)
- 类型: ECharts 环形图 (doughnut)
- 颜色: 按照 Chart Palette 顺序 — 第1色对应 feat, 第2色 fix, ...
- 中心文字: 总数 (stat font)
- 标签位置: 外侧，连接线

### Heatmap (团队热力图)

- 占 4 列满宽
- 7 行 (Mon~Sun) × 24 列 (0h~23h)
- 单元格: 圆角方块, 3px gap, 3px radius
- 渐变: 遵循 MASTER 热力图规则
- Y 轴标签: "一" "二" ... "日" (中文简写)
- X 轴标签: "0" "3" "6" "9" "12" "15" "18" "21" (每3小时标注)
- 悬浮: Tooltip 显示 "周三 14:00 — 23 次提交"

### AI Summary Card

- 占 4 列满宽
- 左侧图标: Lucide `Sparkles` (20px, `var(--secondary)`)
- 内容: AI 总结文字 — `body`, `var(--text-secondary)`, line-height 1.6
- 背景: `var(--surface)` + 左侧 3px 竖线 `var(--secondary-soft)`
- 圆角: `var(--radius-lg)`

```css
.ai-summary-card {
  border-left: 3px solid var(--secondary-soft);
  padding-left: var(--space-5);
}
```
