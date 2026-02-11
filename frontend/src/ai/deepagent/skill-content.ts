/**
 * Waste Detection Skill — 内联内容
 *
 * 由于 DeepAgents 的 Skills 加载器依赖 Node.js fs 模块，
 * 在 Tauri WebView 中无法使用。
 * 我们将 SKILL.md 的内容内联为 TypeScript 常量。
 *
 * 源文件: frontend/skills/waste-detection/SKILL.md
 */

export const WASTE_SKILL_CONTENT = `
## 七种无用功模式判定指南

### W1 代码蒸发
被删代码有业务价值（不是 mock/debug/dead code）且新代码零复用旧逻辑。
- 被动蒸发（产品方向变化）→ wasPassive=true
- 主动蒸发（自己推翻自己）→ wasPassive=false
- 不算 W1：合理重构拆分、删除死代码、删除调试日志
- 浪费行数 = MIN(A.insertions, B.deletions)，复用 30%+ 则打 5 折，mock 数据打 3 折

### W2 反复重写
同文件 7 天内 3+ 次大改（>100 行），每次设计方向不同。
- 同方向渐进迭代不算 W2
- 浪费行数 = 除最后一版外的所有中间版本的 MIN(ins, del) 之和

### W3 闪电回滚
提交后 30 分钟内完全回滚（revert 或等效反向提交）。
- 浪费行数 = reverted commit 的 insertions

### W4 先堆后拆
单次 +200 行到一个文件，3 天内拆分到多文件。
- 拆出的代码与原代码高度相似
- 浪费行数 = churn(增+删) - |净变化|

### W5 破坏性简化
"简化/refactor/clean" 提交删了在用功能，24h 内他人 fix 恢复。
- 浪费行数 = 被删 deletions + 修复 insertions

### W6 碎片化修复
同一功能 4+ 次 fix 才稳定。
- 浪费行数 = fix 提交的总 churn × 0.5

### W7 重复劳动
两人 48h 内对同文件做相似修改，一人被废弃。
- 浪费行数 = 被废弃一方的 insertions

## 严重程度标准
- high: >200 行有效代码浪费 或 导致他人修复
- medium: 50-200 行 或 反复出现
- low: <50 行，偶发

## 不算无用功
- 删除未使用的 import/变量
- 删除 console.log / 调试代码
- 大文件拆分为模块（代码搬运非重写）
- 依赖升级导致的 API 变更
- code review 后修改
- 配置文件变更
`
