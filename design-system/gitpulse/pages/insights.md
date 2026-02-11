# Page: Insights (AI 洞察)

> **Route:** `/insights`
> **Overrides from MASTER.md:** Chat panel, insight card severity styles

---

## Layout

页面分为上下两段：**洞察卡片区** + **对话区**

```
┌──────┬──────────────────────────────────────────┐
│      │  Header: "AI 洞察" + 分类筛选 Tab          │
│ Side ├──────────────────────────────────────────┤
│ bar  │                                          │
│      │  ┌──────────────────────────────────────┐│
│      │  │ 洞察卡片区                            ││
│      │  │ ┌─────────┐ ┌─────────┐             ││  ← 2 列瀑布流
│      │  │ │ 发现 1   │ │ 发现 2   │             ││
│      │  │ │ 巴士因子 │ │ 协作变化 │             ││
│      │  │ └─────────┘ └─────────┘             ││
│      │  │ ┌─────────┐ ┌─────────┐             ││
│      │  │ │ 发现 3   │ │ 发现 4   │             ││
│      │  │ └─────────┘ └─────────┘             ││
│      │  └──────────────────────────────────────┘│
│      │                                          │
│      │  ── 分割线 ───────────────────────────── │
│      │                                          │
│      │  ┌──────────────────────────────────────┐│
│      │  │ AI 对话区                             ││
│      │  │                                      ││
│      │  │ [消息列表]                            ││
│      │  │                                      ││
│      │  │ ┌──────────────────────────┐ [发送]  ││
│      │  │ │ 输入你的问题...            │        ││
│      │  │ └──────────────────────────┘        ││
│      │  └──────────────────────────────────────┘│
│      │                                          │
│      │  ┌──────────────────────────────────────┐│
│      │  │ 报告按钮行                            ││
│      │  └──────────────────────────────────────┘│
│      │                                          │
└──────┴──────────────────────────────────────────┘
```

---

## Components

### Category Filter Tabs

```css
.insight-tabs {
  display: flex;
  gap: var(--space-2);
  padding: 3px;
  background: var(--surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.insight-tab {
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 150ms ease;
}

.insight-tab:hover {
  color: var(--text);
}

.insight-tab.active {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
}
```

**选项：** 全部 / 风险 / 亮点 / 趋势 / 建议

### Insight Cards (洞察卡片)

2 列 grid 布局，每张卡片根据类别有不同的左侧色条：

```css
.insight-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  border-left: 4px solid;
  transition: all 200ms ease;
  cursor: pointer;
}

.insight-card:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-2px);
}

/* 按类别着色 */
.insight-card.risk    { border-left-color: var(--danger); }
.insight-card.highlight { border-left-color: var(--accent); }
.insight-card.trend   { border-left-color: var(--secondary); }
.insight-card.suggest { border-left-color: var(--primary); }
```

**卡片内容：**

```
╭────────────────────────────────╮
│ ⚠ 巴士因子风险        [风险]    │  ← 图标 + 标题 + 类别tag
│                                │
│ src/auth/ 模块100%由 Alex      │  ← 描述文字 body-sm
│ 维护，如果 Alex 离开，         │
│ 该模块无人可接手               │
│                                │
│ 严重程度: ●●●○○  高            │  ← 严重程度指示
╰────────────────────────────────╯
```

**图标映射：**
- 风险: Lucide `AlertTriangle` — `var(--danger)`
- 亮点: Lucide `Sparkles` — `var(--accent)`
- 趋势: Lucide `TrendingUp` — `var(--secondary)`
- 建议: Lucide `Lightbulb` — `var(--primary)`

**严重程度指示器：**
```css
.severity-dots {
  display: flex;
  gap: 3px;
  align-items: center;
}

.severity-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border);
}

.severity-dot.active {
  background: var(--danger);  /* 或对应类别颜色 */
}
```

### Chat Panel (AI 对话区)

```css
.chat-panel {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  padding: var(--space-4);
  overflow-y: auto;
  max-height: 400px;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
```

**消息气泡：**

```css
/* 用户消息 */
.msg-user {
  align-self: flex-end;
  background: var(--primary);
  color: white;
  border-radius: var(--radius-lg) var(--radius-lg) 4px var(--radius-lg);
  padding: 10px 14px;
  max-width: 80%;
  font-size: 14px;
}

/* AI 消息 */
.msg-ai {
  align-self: flex-start;
  background: var(--surface-hover);
  color: var(--text);
  border-radius: var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px;
  padding: 12px 16px;
  max-width: 85%;
  font-size: 14px;
  line-height: 1.7;
}

/* AI 消息头部 */
.msg-ai-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  color: var(--secondary);
  font-size: 12px;
  font-weight: 600;
}
/* Icon: Lucide Bot (14px) + "GitPulse AI" */
```

**Tool 调用状态：**
```css
.tool-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--secondary-soft);
  color: var(--secondary);
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 500;
  margin-bottom: var(--space-2);
}
/* Icon: Lucide Loader2 (12px, animate-spin) + "正在查询提交统计..." */
```

**输入框：**

```css
.chat-input-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--border);
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  background: var(--bg);
  transition: border-color 200ms ease;
}

.chat-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.chat-send-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 200ms ease;
  border: none;
}

.chat-send-btn:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-button);
}

.chat-send-btn:disabled {
  background: var(--text-muted);
  cursor: not-allowed;
}
/* Icon: Lucide Send (16px) */
```

### Report Buttons Row

```css
.report-actions {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4) 0;
}
```

三个按钮使用 `btn-secondary` 变体：
- Lucide `FileText` + "生成周报"
- Lucide `FileBarChart` + "生成月度分析"
- Lucide `Download` + "导出 PDF"

"导出 PDF" 使用 `btn-primary`，其余 `btn-secondary`。
