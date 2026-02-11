---
name: waste-detection
description: Git 提交无用功检测模式识别。识别 7 种代码浪费模式（W1~W7），区分主动/被动浪费，给出量化判定。
---

# Waste Detection Skill — 无用功模式识别

## 概述

本 Skill 教你识别 Git 仓库中的 7 种无用功模式，并做出准确的量化判定。

## 判定原则

1. **疑罪从无**: 不确定时不标记为无用功
2. **区分主动/被动**: 产品方向变化导致的废弃设为 wasPassive=true
3. **看代码质量**: 被删代码如果写得好（有类型、有注释），浪费权重更高
4. **看模式化行为**: 反复出现同类问题比偶发事件更重要
5. **合理重构不算浪费**: 拆分大文件、优化命名、删除死代码是正常工程实践

## 不算无用功的常见场景

- 删除未使用的 import/变量
- 删除 console.log / 调试代码
- 大文件拆分为多个模块（代码只是搬运，没有重写）
- 升级依赖导致的 API 变更
- 合理的 code review 后修改
- 配置文件变更（tsconfig, eslint 等）

## 浪费行数计算规则

### W1 代码蒸发
```
wasted = MIN(A 的 insertions, B 的 deletions on same file)
如果 B 的新代码复用了 A 的 30%+ 逻辑 → wasted *= 0.5
如果被删代码是 mock 数据/硬编码 → wasted *= 0.3
```

### W2 反复重写
```
wasted = Σ(中间版本的 MIN(insertions, deletions))
最后一版不算浪费
```

### W3 闪电回滚
```
wasted = reverted commit 的 insertions
```

### W4 先堆后拆
```
wasted = 原文件的 churn(增+删) - |净变化|
即：搬运过程中的额外开销
```

### W5 破坏性简化
```
wasted = 被删功能的 deletions + 修复者的 insertions
两次提交都是浪费
```

### W6 碎片化修复
```
wasted = Σ(fix 提交的 insertions + deletions) × 0.5
一半是本不该存在的修修补补
```

### W7 重复劳动
```
wasted = 被废弃一方的 insertions
```
