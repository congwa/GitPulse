# Page: Analysis (分析进度页)

> **Route:** `/analysis`
> **Overrides from MASTER.md:** Layout (no sidebar), unique progress animation

---

## Layout Override

- **No sidebar** — 全屏居中，与首页一致
- **Max-width:** 600px
- **垂直布局:** Logo → 仓库名 → 进度条 → 阶段列表 → AI 流 → 跳过按钮
- **背景:** 同首页，带装饰光斑（光斑颜色随进度阶段变化）

---

## Components

### Header

```
Logo: h2 size, var(--primary)
Subtitle: "正在分析 {repoName} 仓库..."
  font: body, var(--text-secondary)
  animate: 文字后面跟 3 个渐隐渐现的点（"..."）
```

### Progress Bar (Override)

比 MASTER 更大更软：

```css
.analysis-progress {
  height: 14px;
  background: var(--primary-soft);
  border-radius: var(--radius-full);
  overflow: hidden;
  position: relative;
}

.analysis-progress-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--primary),
    var(--secondary),
    var(--accent)
  );
  background-size: 200% 100%;
  animation: shimmer 2s ease infinite;
  border-radius: var(--radius-full);
  transition: width 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.analysis-progress-percent {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: white;
  /* 当进度条还短时，百分比在右侧外面 */
}
```

### Stage List

每个阶段是一个小行：

```css
.stage-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 10px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.stage-item.completed {
  color: var(--text);
}

.stage-item.active {
  color: var(--primary);
  font-weight: 600;
}

.stage-item.pending {
  color: var(--text-muted);
}
```

**状态图标：**
- 完成: Lucide `CheckCircle2` (16px) — `var(--accent)`
- 进行中: Lucide `Loader2` (16px) — `var(--primary)`, `animate-spin` (慢速 2s)
- 等待: Lucide `Circle` (16px) — `var(--text-muted)`, stroke-dasharray 虚线

**右侧信息：**
- 完成后显示: 摘要文字（"1,247 条提交"）+ 耗时（"2.3s"）— `caption`, `var(--text-muted)`
- 进行中显示: 子进度（"Alex (3/8)..."）

### AI Stream Area

```css
.ai-stream {
  margin-top: var(--space-6);
  padding: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  min-height: 80px;
  max-height: 120px;
  overflow-y: auto;
}

.ai-stream-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
}

/* 光标闪烁 */
.ai-stream-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background: var(--primary);
  animation: blink 1s step-end infinite;
  margin-left: 2px;
  vertical-align: text-bottom;
}

@keyframes blink {
  50% { opacity: 0; }
}
```

> 前面加一个 Lucide `Sparkles` 图标 (14px, `var(--secondary)`) 表示 AI 输出

### Skip Button

```css
.skip-button {
  /* 使用 btn-ghost 变体 */
  margin-top: var(--space-4);
  align-self: flex-end;
}
```

- Icon: Lucide `SkipForward` (16px)
- 文字: "跳过 AI 分析"
- 仅在阶段 ④~⑦ 时显示，`fadeIn` 动画出现

---

## Background Animation

光斑颜色随阶段变化（微妙的颜色过渡，transition 2s）：

| 阶段 | Blob 1 颜色 | Blob 2 颜色 |
|------|------------|------------|
| ①②③ Git 解析 | `var(--accent-soft)` | `var(--primary-soft)` |
| ④⑤ AI 分析 | `var(--primary-soft)` | `var(--secondary-soft)` |
| ⑥⑦ AI 检测 | `var(--secondary-soft)` | `var(--accent-soft)` |
| ⑧ 完成 | `var(--accent-soft)` | `var(--accent-soft)` |

---

## Completion Animation

分析完成时：
1. 进度条填满 → 渐变变为纯 `var(--accent)` (绿色)
2. 中间出现 Lucide `PartyPopper` 图标 (32px)
3. 文字变为 "分析完成！即将进入仪表盘..."
4. 1s 后 fadeOut 页面 → 跳转 `/dashboard`
