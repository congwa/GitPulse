# Page: Settings (设置)

> **Route:** `/settings`
> **Overrides from MASTER.md:** Form-heavy layout, section cards

---

## Layout

不使用 Bento Grid，而是垂直堆叠的分组卡片：

```
┌──────┬──────────────────────────────────────────┐
│      │  Header: "设置"                           │
│ Side ├──────────────────────────────────────────┤
│ bar  │                                          │
│      │  ┌────────────────────────────────────┐  │
│      │  │ AI 配置                             │  │
│      │  └────────────────────────────────────┘  │
│      │                                          │
│      │  ┌────────────────────────────────────┐  │
│      │  │ 分析配置                            │  │
│      │  └────────────────────────────────────┘  │
│      │                                          │
│      │  ┌────────────────────────────────────┐  │
│      │  │ 外观设置                            │  │
│      │  └────────────────────────────────────┘  │
│      │                                          │
│      │  ┌────────────────────────────────────┐  │
│      │  │ 数据管理                            │  │
│      │  └────────────────────────────────────┘  │
│      │                                          │
└──────┴──────────────────────────────────────────┘
```

**Max-width:** 640px，居中对齐（不像其他页面填满宽度）

---

## Components

### Section Card

```css
.settings-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  margin-bottom: var(--space-5);
}

.settings-section-title {
  font-family: var(--font-heading);
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--space-5);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
/* 标题前有 Lucide 图标 (20px, var(--primary)) */
```

### Form Field

```css
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.form-field:last-child {
  margin-bottom: 0;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.form-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}
```

### Select (下拉选择)

```css
.select {
  padding: 10px 14px;
  padding-right: 36px;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text);
  background: var(--surface);
  appearance: none;
  background-image: url("chevron-down icon");
  background-position: right 12px center;
  cursor: pointer;
  transition: border-color 200ms ease;
}

.select:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
  outline: none;
}
```

### Password Input (API Key)

```css
.password-input-wrapper {
  position: relative;
}

.password-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  color: var(--text-muted);
  transition: color 150ms ease;
}

.password-toggle:hover {
  color: var(--text);
}
/* Icon: Lucide Eye / EyeOff (16px) */
```

### Slider (温度)

```css
.slider-container {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.slider {
  flex: 1;
  -webkit-appearance: none;
  height: 6px;
  border-radius: 3px;
  background: var(--border);
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(255,140,107,0.3);
  transition: transform 150ms ease;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.slider-value {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  min-width: 36px;
  text-align: center;
}
```

### Tag Input (忽略文件类型/目录/作者)

```css
.tag-input-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  min-height: 42px;
  align-items: center;
  cursor: text;
  transition: border-color 200ms ease;
}

.tag-input-container:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.tag-input-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--primary-soft);
  color: var(--primary);
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
}

.tag-input-tag .remove {
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 150ms ease;
}

.tag-input-tag .remove:hover {
  opacity: 1;
}
/* Remove icon: Lucide X (10px) */

.tag-input-field {
  border: none;
  outline: none;
  font-size: 13px;
  background: transparent;
  color: var(--text);
  min-width: 60px;
  flex: 1;
}
```

### Test Connection Button

```css
.test-connection-btn {
  /* btn-secondary 变体 */
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
```

**状态：**
- 默认: Lucide `Zap` + "测试连接"
- 测试中: Lucide `Loader2` (animate-spin) + "连接中..."
- 成功: Lucide `CheckCircle2` (`var(--accent)`) + "连接成功 (238ms)"
- 失败: Lucide `XCircle` (`var(--danger)`) + 错误信息

### Theme Switcher (主题切换)

不使用 Select，使用三段式选择器：

```css
.theme-switcher {
  display: inline-flex;
  padding: 3px;
  background: var(--bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  gap: 2px;
}

.theme-option {
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 150ms ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.theme-option.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-card);
  font-weight: 600;
}
```

- 亮色: Lucide `Sun` (14px) + "亮色"
- 暗色: Lucide `Moon` (14px) + "暗色"
- 系统: Lucide `Monitor` (14px) + "系统"

### Data Management Section

```
缓存大小: 只读显示，"23.4 MB" — mono font, var(--text)

[清除缓存] — btn-ghost + Lucide Trash2, 点击后确认弹窗
[导出数据] — btn-ghost + Lucide Download
```

**清除缓存确认弹窗：** 使用 MASTER 的 Modal 规范
- 标题: "确定清除所有缓存？"
- 描述: "清除后需要重新分析所有仓库"
- 确认按钮: `var(--danger)` 背景 + "清除"
- 取消按钮: `btn-ghost` + "取消"

---

## AI Section Icons

| 配置组 | 图标 |
|--------|------|
| AI 配置 | Lucide `Bot` |
| 分析配置 | Lucide `SlidersHorizontal` |
| 外观设置 | Lucide `Palette` |
| 数据管理 | Lucide `Database` |
