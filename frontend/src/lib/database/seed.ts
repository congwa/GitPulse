/**
 * GitPulse Database Seeder
 *
 * 初始化数据库表结构（由 schema migration 完成），
 * 不再灌入 demo 假数据。
 * 真实数据将由 git 分析流程和 AI 模块产生。
 */

import type { GitPulseDB } from './index'

/**
 * seedDatabase — 保留接口兼容，但不再插入假数据
 */
export async function seedDatabase(_db: GitPulseDB): Promise<void> {
  // Schema migration 已在 GitPulseDB.init() 中完成
  // 真实数据由以下流程产生：
  //   1. Home → 选择仓库 → Analysis 页 → git log 解析 → 数据入库
  //   2. AI 模块 → 结构化输出 → ai_results 表
  console.log('[Seed] No demo data — clean start')
}
