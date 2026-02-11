# Page: Home (首页 — 项目选择)

> **Route:** `/`
> **Overrides from MASTER.md:** Layout (no sidebar), unique visual treatment

---

## Layout Override

- **No sidebar** — 首页是独立的全屏页面
- **居中布局** — 内容垂直水平居中，max-width: 640px
- **背景** — 使用 `var(--bg)` + 微弱的渐变装饰（从 `var(--primary-soft)` 的圆形模糊光斑）

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                                                     │
│          ╭─────────────────────────────╮            │
│          │  Logo + 标题                 │            │
│          │                             │            │
│          │  ┌───────────────────────┐  │            │
│          │  │  拖入 / 点击选择区域   │  │            │
│          │  └───────────────────────┘  │            │
│          │                             │            │
│          │  最近项目卡片（横向滚动）    │            │
│          │  ┌─────┐ ┌─────┐ ┌─────┐  │            │
│          │  │     │ │     │ │     │  │            │
│          │  └─────┘ └─────┘ └─────┘  │            │
│          │                             │            │
│          ╰─────────────────────────────╯            │
│                                                     │
│                  ○ ○ ○  装饰光斑                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Components

### Logo + Title

```
Font: var(--font-heading) Varela Round
Size: display (36px)
Color: var(--primary)
Subtitle: body-sm, var(--text-secondary)
  "用数据讲述团队的代码故事"
```

### Drop Zone (拖入/选择区域)

```css
.drop-zone {
  border: 2px dashed var(--border);
  border-radius: var(--radius-xl);       /* 20px */
  padding: 40px;
  text-align: center;
  transition: all 200ms ease;
  cursor: pointer;
  background: var(--surface);
}

.drop-zone:hover,
.drop-zone.drag-over {
  border-color: var(--primary);
  background: var(--primary-soft);
  box-shadow: var(--shadow-glow);
}
```

- Icon: Lucide `FolderOpen` (48px, `var(--text-muted)`)
- Hover icon 变为 `var(--primary)`
- 文字："拖入项目文件夹，或点击选择" — `body`, `var(--text-secondary)`
- 拖入时文字变为："松开以打开项目" + 背景高亮

### Recent Project Cards

```css
.repo-card {
  width: 180px;
  flex-shrink: 0;
  padding: var(--space-4);
  border-radius: var(--radius-lg);       /* 16px */
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: all 250ms var(--transition-bounce);
}

.repo-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-card-hover);
  border-color: var(--primary-soft);
}
```

**卡片内容：**
- 仓库名: `h3` weight, truncate
- 成员数: `caption` + Lucide `Users` (14px)
- 上次分析: `caption`, `var(--text-muted)`, 相对时间（"2天前"）
- 分析状态: 小圆点 — 绿色(已分析) / 灰色(未分析)

**列表容器:** 横向 flex，gap `var(--space-4)`，overflow-x auto，snap

### Decorative Blobs

```css
/* 背景装饰光斑 */
.blob-1 {
  position: fixed;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: var(--primary-soft);
  opacity: 0.3;
  filter: blur(80px);
  top: -100px;
  right: -50px;
  pointer-events: none;
}

.blob-2 {
  position: fixed;
  width: 250px;
  height: 250px;
  border-radius: 50%;
  background: var(--secondary-soft);
  opacity: 0.25;
  filter: blur(80px);
  bottom: -80px;
  left: -30px;
  pointer-events: none;
}
```

> Dark Mode: opacity 降至 0.15

---

## Interaction Flow

1. 拖入文件夹 / 点击选择 → 调用 `select_directory`
2. 校验 Git 仓库 → 成功则跳转 `/analysis`
3. 失败则 drop zone 边框变 `var(--danger)`，shake 动画，提示 "这不是一个 Git 仓库"
4. 点击最近项目卡片 → `check_incremental` → 直接跳转或弹更新弹窗

### Update Dialog (更新弹窗)

使用 MASTER 的 Modal 规范。三个选项用三个可选卡片展示：

```
╭────────────────────────────────────╮
│  检测到 127 条新提交               │
│                                    │
│  ┌──────────┐ ┌──────────┐       │
│  │ ⚡ 快速   │ │ 🔄 完整   │       │
│  │  仅统计   │ │  含 AI    │       │
│  │  ~3s     │ │  ~30s    │       │
│  └──────────┘ └──────────┘       │
│                                    │
│  ┌──────────────────────┐         │
│  │ 📦 使用缓存（跳过）    │         │
│  └──────────────────────┘         │
│                                    │
╰────────────────────────────────────╯
```

选项卡片: `border-radius: 12px`, 选中时 `border: 2px solid var(--primary)` + `background: var(--primary-soft)`
