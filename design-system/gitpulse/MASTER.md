# GitPulse Design System — Master File

> **LOGIC:** When building a specific page, first check `design-system/gitpulse/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** GitPulse
**Style:** Soft Claymorphism + Bento Grid
**Mood:** 软糯、可爱、温暖、友好 — 像喵喵记账那样让人觉得亲切
**Category:** Personal Analytics Dashboard (Desktop App via Tauri)
**Theme:** Light + Dark dual mode

---

## 1. Design Philosophy

GitPulse 是个人项目，不是企业 BI 工具。它的调性是：

- **软** — 大圆角、柔和阴影、没有尖锐的线条
- **暖** — 暖色系为主，冷色系做点缀，不刺眼
- **趣** — 小动效、微交互、不死板的数据展示
- **呼吸感** — 充足留白，卡片之间有呼吸空间，不拥挤

> 想象你在一个舒服的下午，端着奶茶，轻松地看看团队的代码故事。

---

## 2. Color Palette

### Light Mode (默认)

| Role | Hex | CSS Variable | Tailwind | 说明 |
|------|-----|-------------|----------|------|
| Background | `#FFF8F3` | `--bg` | `bg-[#FFF8F3]` | 暖白色背景，微微偏奶茶 |
| Surface | `#FFFFFF` | `--surface` | `bg-white` | 卡片/容器背景 |
| Surface Hover | `#FFF1E8` | `--surface-hover` | `bg-[#FFF1E8]` | 卡片悬浮 |
| Primary | `#FF8C6B` | `--primary` | `bg-[#FF8C6B]` | 暖橘色，主色调 |
| Primary Soft | `#FFD4C4` | `--primary-soft` | `bg-[#FFD4C4]` | 浅橘色，背景装饰 |
| Secondary | `#A78BFA` | `--secondary` | `bg-[#A78BFA]` | 薰衣草紫，辅助色 |
| Secondary Soft | `#DDD6FE` | `--secondary-soft` | `bg-[#DDD6FE]` | 浅紫色，标签背景 |
| Accent | `#34D399` | `--accent` | `bg-[#34D399]` | 薄荷绿，成功/增长 |
| Accent Soft | `#A7F3D0` | `--accent-soft` | `bg-[#A7F3D0]` | 浅绿色 |
| Warning | `#FBBF24` | `--warning` | `bg-[#FBBF24]` | 暖黄色，警告 |
| Danger | `#FB7185` | `--danger` | `bg-[#FB7185]` | 柔粉红，危险/下降 |
| Text Primary | `#3D2C2C` | `--text` | `text-[#3D2C2C]` | 深棕色，温暖不刺眼 |
| Text Secondary | `#8B7E7E` | `--text-secondary` | `text-[#8B7E7E]` | 中棕色，辅助文字 |
| Text Muted | `#BEB4B4` | `--text-muted` | `text-[#BEB4B4]` | 浅棕色，占位/禁用 |
| Border | `#F0E4DB` | `--border` | `border-[#F0E4DB]` | 暖灰色边框 |
| Border Focus | `#FF8C6B` | `--border-focus` | `border-[#FF8C6B]` | 聚焦时的边框 |

### Dark Mode

| Role | Hex | CSS Variable | Tailwind | 说明 |
|------|-----|-------------|----------|------|
| Background | `#1A1218` | `--bg` | `dark:bg-[#1A1218]` | 深棕黑，温暖的深色 |
| Surface | `#2A1F24` | `--surface` | `dark:bg-[#2A1F24]` | 卡片背景 |
| Surface Hover | `#352930` | `--surface-hover` | `dark:bg-[#352930]` | 卡片悬浮 |
| Primary | `#FF9E80` | `--primary` | `dark:bg-[#FF9E80]` | 暖橘色（稍亮） |
| Primary Soft | `#3D2A22` | `--primary-soft` | `dark:bg-[#3D2A22]` | 深橘色背景 |
| Secondary | `#B89EFF` | `--secondary` | `dark:bg-[#B89EFF]` | 薰衣草紫（稍亮） |
| Secondary Soft | `#2D2640` | `--secondary-soft` | `dark:bg-[#2D2640]` | 深紫色背景 |
| Accent | `#6EE7B7` | `--accent` | `dark:bg-[#6EE7B7]` | 薄荷绿（稍亮） |
| Accent Soft | `#1A3329` | `--accent-soft` | `dark:bg-[#1A3329]` | 深绿色背景 |
| Warning | `#FCD34D` | `--warning` | `dark:bg-[#FCD34D]` | 暖黄 |
| Danger | `#FDA4AF` | `--danger` | `dark:bg-[#FDA4AF]` | 柔粉红 |
| Text Primary | `#F5EDE8` | `--text` | `dark:text-[#F5EDE8]` | 暖白色文字 |
| Text Secondary | `#A89898` | `--text-secondary` | `dark:text-[#A89898]` | 中灰色 |
| Text Muted | `#6B5E5E` | `--text-muted` | `dark:text-[#6B5E5E]` | 暗灰色 |
| Border | `#3D3035` | `--border` | `dark:border-[#3D3035]` | 暗边框 |
| Border Focus | `#FF9E80` | `--border-focus` | `dark:border-[#FF9E80]` | 聚焦边框 |

### Chart Palette (成员配色)

每个成员分配固定颜色，在 Light/Dark 下使用同一组（Dark 下自动提高亮度 10%）：

| 成员# | Hex | 名称 | 情绪 |
|--------|-----|------|------|
| 1 | `#FF8C6B` | 蜜桃橘 | 温暖、主角感 |
| 2 | `#A78BFA` | 薰衣草 | 优雅、沉稳 |
| 3 | `#34D399` | 薄荷绿 | 清新、活力 |
| 4 | `#F472B6` | 樱花粉 | 甜美、温柔 |
| 5 | `#38BDF8` | 天空蓝 | 开阔、冷静 |
| 6 | `#FBBF24` | 蜂蜜黄 | 明快、开朗 |
| 7 | `#FB923C` | 杏子橙 | 活泼、热情 |
| 8 | `#C084FC` | 丁香紫 | 神秘、创意 |

### 语义色

```
增长/正面:   var(--accent)     薄荷绿
下降/警告:   var(--warning)    蜂蜜黄
危险/异常:   var(--danger)     柔粉红
中性信息:    var(--text-secondary)
```

---

## 3. Typography

**Font Pairing:** Varela Round (标题) + Nunito Sans (正文)

- **Mood:** soft, rounded, friendly, approachable, warm, gentle
- **Best For:** 友好品牌、轻松工具、个人项目

**Google Fonts:**
```css
@import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;500;600;700&family=Varela+Round&display=swap');
```

**Tailwind Config:**
```js
fontFamily: {
  heading: ['Varela Round', 'system-ui', 'sans-serif'],
  body: ['Nunito Sans', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'Fira Code', 'monospace'], // 代码/数字
}
```

### Type Scale

| Token | Size | Weight | Font | Usage |
|-------|------|--------|------|-------|
| `display` | 36px / 2.25rem | 700 | heading | 首页大标题 |
| `h1` | 28px / 1.75rem | 700 | heading | 页面标题 |
| `h2` | 22px / 1.375rem | 600 | heading | 卡片标题、分区标题 |
| `h3` | 18px / 1.125rem | 600 | heading | 子标题 |
| `body` | 15px / 0.9375rem | 400 | body | 正文 |
| `body-sm` | 13px / 0.8125rem | 400 | body | 辅助文字、描述 |
| `caption` | 11px / 0.6875rem | 500 | body | 标签、时间戳 |
| `stat` | 32px / 2rem | 700 | mono | 大数字 KPI |
| `code` | 13px / 0.8125rem | 400 | mono | 代码片段、commit hash |

---

## 4. Spacing & Layout

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | 内部微间距 |
| `--space-2` | `8px` | 图标间距、紧凑间距 |
| `--space-3` | `12px` | 卡片内部元素间距 |
| `--space-4` | `16px` | 标准内边距 |
| `--space-5` | `20px` | 卡片内边距 |
| `--space-6` | `24px` | 卡片间距（Bento gap） |
| `--space-8` | `32px` | 分区间距 |
| `--space-10` | `40px` | 页面顶部间距 |
| `--space-12` | `48px` | 大分区间距 |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `8px` | 小按钮、标签 |
| `--radius-md` | `12px` | 输入框、小卡片 |
| `--radius-lg` | `16px` | 标准卡片 |
| `--radius-xl` | `20px` | 大卡片、图表容器 |
| `--radius-2xl` | `24px` | 主容器、模态框 |
| `--radius-full` | `9999px` | 头像、圆形按钮 |

> 原则：**能圆就圆**，最小 8px，卡片 16px 起步。

### Bento Grid 规范

```css
/* 基础 Bento Grid */
.bento-grid {
  display: grid;
  gap: 20px;                        /* --space-5 */
  grid-template-columns: repeat(4, 1fr);
  padding: 24px;                    /* --space-6 */
}

/* 响应式 */
@media (max-width: 1024px) { grid-template-columns: repeat(2, 1fr); }
@media (max-width: 640px)  { grid-template-columns: 1fr; }

/* 卡片尺寸变体 */
.bento-1x1 { }                       /* 默认 */
.bento-2x1 { grid-column: span 2; }  /* 宽卡片 */
.bento-2x2 { grid-column: span 2; grid-row: span 2; }  /* 大卡片 */
```

---

## 5. Shadows & Depth

### Claymorphism Shadows

柔软的双层阴影，给卡片一种"软糖"的质感：

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `--shadow-card` | `0 4px 14px rgba(255,140,107,0.08), 0 1px 3px rgba(0,0,0,0.04)` | `0 4px 14px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)` |
| `--shadow-card-hover` | `0 8px 25px rgba(255,140,107,0.15), 0 2px 6px rgba(0,0,0,0.06)` | `0 8px 25px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.25)` |
| `--shadow-button` | `0 2px 8px rgba(255,140,107,0.2)` | `0 2px 8px rgba(0,0,0,0.3)` |
| `--shadow-inner` | `inset 0 2px 4px rgba(0,0,0,0.04)` | `inset 0 2px 4px rgba(0,0,0,0.15)` |
| `--shadow-glow` | `0 0 20px rgba(255,140,107,0.15)` | `0 0 20px rgba(255,158,128,0.1)` |

---

## 6. Component Specs

### Buttons

```css
/* Primary Button — 软糯橘色 */
.btn-primary {
  background: var(--primary);
  color: white;
  padding: 10px 20px;
  border-radius: var(--radius-md);    /* 12px */
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: 14px;
  border: none;
  box-shadow: var(--shadow-button);
  transition: all 200ms cubic-bezier(0.34, 1.56, 0.64, 1); /* 软弹 */
  cursor: pointer;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255,140,107,0.3);
}

.btn-primary:active {
  transform: translateY(0) scale(0.97);
}

/* Secondary Button — 透明描边 */
.btn-secondary {
  background: transparent;
  color: var(--primary);
  padding: 10px 20px;
  border: 2px solid var(--primary-soft);
  border-radius: var(--radius-md);
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: 14px;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-secondary:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
}

/* Ghost Button — 轻量操作 */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  transition: all 150ms ease;
  cursor: pointer;
}

.btn-ghost:hover {
  background: var(--surface-hover);
  color: var(--text);
}
```

### Cards (Bento Card)

```css
.card {
  background: var(--surface);
  border-radius: var(--radius-lg);    /* 16px */
  padding: var(--space-5);            /* 20px */
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  transition: all 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.card:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-3px);
  border-color: var(--primary-soft);
}

/* 可点击卡片 */
.card-interactive {
  cursor: pointer;
}

/* 统计数字卡片 */
.card-stat {
  padding: var(--space-4);
  text-align: center;
}

.card-stat .value {
  font-family: var(--font-mono);
  font-size: 32px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
}

.card-stat .label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 6px;
}

.card-stat .trend {
  font-size: 12px;
  font-weight: 600;
  margin-top: 4px;
}

.card-stat .trend.up   { color: var(--accent); }
.card-stat .trend.down { color: var(--danger); }
```

### Inputs

```css
.input {
  padding: 10px 14px;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);    /* 12px */
  font-family: var(--font-body);
  font-size: 15px;
  color: var(--text);
  background: var(--surface);
  transition: all 200ms ease;
}

.input:focus {
  border-color: var(--primary);
  outline: none;
  box-shadow: 0 0 0 4px var(--primary-soft);
}

.input::placeholder {
  color: var(--text-muted);
}
```

### Tags / Badges

```css
.tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 600;
  gap: 4px;
}

.tag-primary   { background: var(--primary-soft); color: var(--primary); }
.tag-secondary { background: var(--secondary-soft); color: var(--secondary); }
.tag-accent    { background: var(--accent-soft); color: #059669; }
.tag-danger    { background: #FFE4E6; color: #E11D48; }
/* Dark mode: 使用对应的 soft 暗色变体 */
```

### Sidebar

```css
.sidebar {
  width: 220px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: var(--space-4) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 10px 12px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 150ms ease;
  cursor: pointer;
}

.sidebar-item:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.sidebar-item.active {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 600;
}
```

### Modal / Dialog

```css
.modal-overlay {
  background: rgba(61, 44, 44, 0.4);   /* Light: 棕色遮罩 */
  backdrop-filter: blur(8px);
  /* Dark: rgba(0, 0, 0, 0.6) */
}

.modal {
  background: var(--surface);
  border-radius: var(--radius-2xl);     /* 24px */
  padding: var(--space-8);
  box-shadow: 0 25px 50px rgba(0,0,0,0.15);
  max-width: 480px;
  width: 90%;
  border: 1px solid var(--border);
}
```

### Progress Bar

```css
.progress-bar {
  height: 10px;
  background: var(--primary-soft);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--secondary));
  border-radius: var(--radius-full);
  transition: width 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

---

## 7. Chart Style Guide

所有图表遵循统一的暖色调风格：

### 通用规则

```
Container:
  - background: var(--surface)
  - border-radius: var(--radius-xl)    /* 20px */
  - padding: 20px
  - border: 1px solid var(--border)

Axis:
  - color: var(--text-muted)
  - fontSize: 11px
  - fontFamily: var(--font-body)

Grid Lines:
  - Light: #F0E4DB (与 border 同色)
  - Dark: #3D3035

Tooltip:
  - background: var(--surface)
  - borderRadius: 12px
  - boxShadow: var(--shadow-card-hover)
  - padding: 12px 16px
  - border: 1px solid var(--border)
  - fontFamily: var(--font-body)
  - fontSize: 13px

Legend:
  - position: bottom center
  - fontSize: 12px
  - itemGap: 16px
  - icon: 'roundRect' (圆角方块)

Animation:
  - duration: 600ms
  - easing: cubicInOut
  - 数字递增动画: 500ms
```

### 热力图特殊规则

```
Light Mode 渐变:
  最低: #FFF1E8 (接近背景)
  中等: #FFD4C4 (primary-soft)
  最高: #FF8C6B (primary)

Dark Mode 渐变:
  最低: #2A1F24 (接近 surface)
  中等: #5C3D33
  最高: #FF9E80 (primary)

格子:
  borderRadius: 3px
  gap: 3px
```

---

## 8. Animation & Motion

### Transition Presets

```css
/* 标准过渡 */
--transition-fast:  150ms ease;
--transition-base:  200ms ease;
--transition-slow:  300ms ease;

/* 软弹过渡 (卡片悬浮、按钮按下) */
--transition-bounce: 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
```

### 微动效

| 场景 | 动画 | 时长 | 曲线 |
|------|------|------|------|
| 卡片悬浮 | `translateY(-3px)` | 250ms | bounce |
| 按钮点击 | `scale(0.97)` | 100ms | ease |
| 页面进入 | `fadeIn + translateY(10px)` | 300ms | ease-out |
| 数字递增 | 从 0 滚动到目标值 | 500ms | ease-out |
| 进度条 | 宽度变化 | 300ms | bounce |
| 标签出现 | `fadeIn + scale(0.9→1)` | 200ms | bounce |
| 侧边栏切换 | `backgroundColor` | 150ms | ease |
| 图表加载 | ECharts `animationDuration: 600` | 600ms | cubicInOut |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Icon System

**Icon Set:** Lucide Icons (https://lucide.dev)

- Size: `20px` (侧边栏/按钮) / `16px` (内联) / `24px` (页面标题)
- Stroke Width: `1.75` (比默认的 2 稍细，更柔和)
- Color: 继承 `currentColor`

**常用图标映射：**

| 功能 | Lucide 图标 |
|------|------------|
| 首页 | `Home` |
| 仪表盘 | `LayoutDashboard` |
| 团队 | `Users` |
| 成员 | `User` |
| 模块 | `FolderTree` |
| AI 洞察 | `Sparkles` |
| 设置 | `Settings` |
| 分析/进度 | `ScanSearch` |
| 增长 | `TrendingUp` |
| 下降 | `TrendingDown` |
| 提交 | `GitCommit` |
| 分支 | `GitBranch` |
| 文件 | `FileCode2` |
| 时间 | `Clock` |
| 日历 | `Calendar` |
| AI/机器人 | `Bot` |
| 发送 | `Send` |
| 导出 | `Download` |
| 跳过 | `SkipForward` |

> 禁止使用 Emoji 作为 UI 图标。仅在 AI 对话气泡中允许 Emoji。

---

## 10. Responsive Breakpoints

| Breakpoint | Width | Columns | Sidebar |
|-----------|-------|---------|---------|
| Mobile | < 640px | 1 | Hidden |
| Tablet | 640-1024px | 2 | Collapsed (icon only) |
| Desktop | 1024-1440px | 3-4 | Full (220px) |
| Wide | > 1440px | 4 | Full (220px) |

> GitPulse 是桌面应用，主要目标分辨率 1280×800 ~ 1920×1080。
> 但仍需支持 Tauri 窗口缩放。

---

## 11. Dark Mode Implementation

```css
/* CSS Variables 方案 */
:root {
  --bg: #FFF8F3;
  --surface: #FFFFFF;
  --text: #3D2C2C;
  /* ... 所有 Light Mode 变量 */
}

:root.dark {
  --bg: #1A1218;
  --surface: #2A1F24;
  --text: #F5EDE8;
  /* ... 所有 Dark Mode 变量 */
}

/* Tailwind: 使用 class 策略 */
/* tailwind.config: darkMode: 'class' */
```

**切换方式：** 设置页提供三种选项：
- Light（亮色）
- Dark（暗色）
- System（跟随系统）

---

## 12. Anti-Patterns (Do NOT Use)

- **No emoji icons** — 使用 Lucide SVG 图标，不用 emoji 做 UI 元素
- **No sharp corners** — 最小 border-radius 8px，卡片 16px 起
- **No cold grays** — 灰色系都要偏暖（带棕色调），不用纯灰 `#666`
- **No dense layouts** — 元素之间保持呼吸感，gap 不小于 16px
- **No heavy borders** — 边框颜色要轻，1px，不要 2px 以上的描边
- **No sudden transitions** — 所有状态变化必须有过渡动画
- **No pure black** — Dark Mode 背景不用 `#000`，用深棕 `#1A1218`
- **No pure white text on dark** — 用暖白 `#F5EDE8` 代替 `#FFFFFF`
- **No enterprise feel** — 不要看起来像 Jira/Grafana，要像个人工具

---

## 13. Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] 使用 Lucide SVG 图标，无 emoji 作为 UI 元素
- [ ] 所有可点击元素有 `cursor-pointer`
- [ ] Hover 状态有平滑过渡 (150-300ms)
- [ ] 卡片 border-radius >= 16px
- [ ] Light/Dark 两个模式都检查过
- [ ] Light Mode 文字对比度 >= 4.5:1
- [ ] Dark Mode 使用暖色深底，非纯黑
- [ ] Focus 状态可见（键盘导航）
- [ ] `prefers-reduced-motion` 已处理
- [ ] 字体使用 Varela Round (标题) + Nunito Sans (正文)
- [ ] 数字使用 mono 字体 (JetBrains Mono)
- [ ] 图表容器有 20px 圆角和 border
- [ ] 卡片间距 >= 20px (Bento gap)
- [ ] 颜色变量使用 CSS Variables，非硬编码
