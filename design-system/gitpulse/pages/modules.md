# Page: Modules (模块分析)

> **Route:** `/modules`
> **Overrides from MASTER.md:** Treemap interactive drill-down, Sankey colors

---

## Layout

```
┌──────┬──────────────────────────────────────────┐
│      │  Header: "模块分析" + 目录深度选择器       │
│ Side ├──────────────────────────────────────────┤
│ bar  │                                          │
│      │  ┌────────────────────────────────────┐  │
│      │  │ 代码所有权 Treemap                  │  │  ← 4x2 (大卡片)
│      │  │ 可钻入                              │  │
│      │  └────────────────────────────────────┘  │
│      │                                          │
│      │  ┌────────────────────────────────────┐  │
│      │  │ 模块-成员桑基图                     │  │  ← 4x1
│      │  └────────────────────────────────────┘  │
│      │                                          │
│      │  ┌──────────────────┐ ┌──────────────┐  │
│      │  │ 模块详情表格      │ │ 文件热点气泡  │  │  ← 2x1 + 2x1
│      │  └──────────────────┘ └──────────────┘  │
│      │                                          │
│      │  ┌────────────────────────────────────┐  │
│      │  │ AI 模块洞察                         │  │  ← 4x1
│      │  └────────────────────────────────────┘  │
│      │                                          │
└──────┴──────────────────────────────────────────┘
```

---

## Components

### Directory Depth Selector

在 header 右侧，与时间选择器类似：
- Options: "1 层 / 2 层 / 3 层"
- 默认: 2 层
- 使用 MASTER 的 Select 组件

### Code Ownership Treemap

**最大的可视化组件，占 4×2 网格：**

```css
.treemap-container {
  min-height: 360px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: var(--space-3);
}
```

**颜色规则：**
- 每个目录块的颜色 = 主负责人的 Chart 颜色
- 块的深浅 = 负责人的贡献占比（越高越深）
- 边框: `var(--surface)` 2px (在块之间形成分割)

**块内文字：**
- 大块(>100px): 目录名 + 主负责人名 + 占比%
  - 目录名: `body-sm`, 白色, font-weight 600
  - 负责人: `caption`, 白色半透明
- 中块(50-100px): 仅目录名
- 小块(<50px): 无文字，悬浮时 Tooltip 显示

**交互：**
- 悬浮: 块轮廓高亮 (2px outline, white)
- 点击: drill-down 进入子目录
- 面包屑: Treemap 顶部显示当前路径 `src / components / ui`
  - 可点击返回上层
  - `caption` size, `var(--text-muted)`

### Sankey Chart (模块-成员桑基图)

```
颜色:
  左侧(成员): 使用成员的 Chart 颜色
  右侧(模块): 使用主负责人的 Chart 颜色
  连线: 成员颜色, opacity 0.3, 悬浮时 opacity 0.6

节点:
  border-radius: 4px (方形节点)
  label: body-sm, var(--text)
  padding: 4px

连线:
  curvature: 0.5
  width: 按提交占比
  min-width: 2px
```

### Module Detail Table

与 Team 页的表格风格一致（行间距、圆角行、hover 效果）。

**列设计：**

| 列 | 内容 | 样式 |
|----|------|------|
| 模块路径 | `src/components/` | `code` font, truncate |
| 文件数 | 45 | `mono` font, right-align |
| 提交数 | 312 | `mono` font, right-align |
| 主负责人 | Alex | 首字母头像(20px) + 名字 |
| 热度 | 小条状图 | 橘色条, 宽度 = 热度占比, height 6px, radius 3px |

### File Hotspot Bubble Chart

- X 轴: 修改次数
- Y 轴: 涉及成员数
- 气泡大小: 近 30 天修改次数
- 气泡颜色: 主负责人的 Chart 颜色, opacity 0.6
- 悬浮: 显示文件名 + 修改详情
- 气泡 border: 2px solid 同色(opacity 1)

**警告标记：** 如果文件修改次数 > 阈值，气泡边框变为 `var(--danger)`

### AI Module Insight

与其他页面的 AI 卡片相同。特别关注：
- 巴士因子风险的模块用 `var(--danger)` 标记
- 高复杂度模块用 `var(--warning)` 标记
