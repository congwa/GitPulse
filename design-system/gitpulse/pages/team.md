# Page: Team (团队全景 — 成员对比)

> **Route:** `/team`
> **Overrides from MASTER.md:** Radar chart interaction, member cards

---

## Layout

```
┌──────┬──────────────────────────────────────────┐
│      │  Header: "团队全景"                       │
│ Side ├──────────────────────────────────────────┤
│ bar  │                                          │
│      │  ┌────────────────────────────────────┐  │
│      │  │ 成员贡献堆叠面积图                   │  │  ← 4x1
│      │  │ 每人一个颜色层                       │  │
│      │  └────────────────────────────────────┘  │
│      │                                          │
│      │  ┌──────────────────┐ ┌──────────────┐  │
│      │  │ 雷达图对比        │ │ 选人面板      │  │  ← 2x1 + 2x1
│      │  │ 2-3人叠加        │ │ 可勾选成员    │  │
│      │  └──────────────────┘ └──────────────┘  │
│      │                                          │
│      │  ┌────────────────────────────────────┐  │
│      │  │ 成员排名表格                        │  │  ← 4x1
│      │  └────────────────────────────────────┘  │
│      │                                          │
│      │  ┌────────────────────────────────────┐  │
│      │  │ AI 团队洞察                         │  │  ← 4x1
│      │  └────────────────────────────────────┘  │
│      │                                          │
└──────┴──────────────────────────────────────────┘
```

---

## Components

### Stacked Area Chart (贡献面积图)

- X 轴: 按周/月，由时间选择器控制
- Y 轴: 提交数量
- 每个成员一层，颜色从 Chart Palette 取
- 填充 opacity: 0.6（不要太实，要透气）
- 线条: 2px, smooth curve
- 悬浮时高亮当前层，其他层 opacity 降至 0.2

### Radar Chart (雷达图)

- 六维度轴:
  1. 提交频率
  2. 代码量
  3. 模块广度
  4. 代码存活率
  5. 提交消息质量
  6. 协作指数
- 最多同时显示 3 人
- 每人用自己的 Chart 颜色，填充 opacity 0.15
- 轴标签: `caption` size, `var(--text-muted)`
- 外圈: 虚线圆 `var(--border)`

### Member Select Panel (选人面板)

在雷达图右侧，显示所有成员的 checkbox list：

```css
.member-check-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 150ms ease;
}

.member-check-item:hover {
  background: var(--surface-hover);
}

.member-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
```

- 选中时: 名字加粗，颜色点变实心
- 最多可选 3 人，超过时提示 "最多选择 3 位成员"

### Member Ranking Table (排名表格)

```css
.member-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 8px;           /* 行间距 */
}

.member-table-row {
  background: var(--surface);
  border-radius: var(--radius-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.member-table-row:hover {
  background: var(--surface-hover);
  transform: translateX(4px);      /* 轻微右移提示可点击 */
}

.member-table-row td {
  padding: 12px 16px;
}

.member-table-row td:first-child {
  border-radius: var(--radius-md) 0 0 var(--radius-md);
}

.member-table-row td:last-child {
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}
```

**列设计：**

| 列 | 内容 | 样式 |
|----|------|------|
| 排名 | 数字或特殊标记 | #1: 小皇冠图标 (Lucide `Crown`, `var(--warning)`), #2/#3: 粗体数字 |
| 头像 | Gravatar 或首字母圆形 | 32px, `border-radius: 50%`, Chart Palette 背景色 |
| 姓名 | 名字 | `body`, font-weight 600 |
| 提交数 | 数字 | `mono` font, right-align |
| 代码量 | +12.3K | `mono` font, `var(--accent)` if positive |
| AI 标签 | 1-2 个 tag | 使用 MASTER 的 `.tag` 组件 |

点击行 → 跳转 `/member/:email`

### AI Team Insight

与 Dashboard 的 AI Summary Card 相同，使用 `var(--secondary)` 左边竖线。
