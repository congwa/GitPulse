/**
 * GitPulse AI 结果缓存层
 *
 * 利用 SQLite 的 ai_results 表缓存 AI 分析结果，
 * 避免重复调用 API，同时提供离线降级数据。
 */

import { getDBSync } from '@/lib/database'

const CACHE_TTL: Record<string, number> = {
  dashboard_summary: 30 * 60 * 1000,   // 30 分钟
  member_tags: 60 * 60 * 1000,         // 1 小时
  team_insights: 30 * 60 * 1000,       // 30 分钟
  anomaly_report: 60 * 60 * 1000,      // 1 小时
  member_portrait: 60 * 60 * 1000,     // 1 小时
}

/**
 * 从缓存获取 AI 结果
 * @returns 解析后的结果，或 null（缓存不存在或已过期）
 */
export function getCachedResult<T>(type: string, target?: string): T | null {
  const db = getDBSync()
  if (!db) return null

  const row = db.getAIResult(type, target ?? null)
  if (!row) return null

  // 检查过期时间
  const ttl = CACHE_TTL[type] ?? 30 * 60 * 1000
  if (Date.now() - row.created_at > ttl) return null

  try {
    return JSON.parse(row.result_json) as T
  } catch {
    return null
  }
}

/**
 * 保存 AI 结果到缓存
 */
export function setCachedResult(
  type: string,
  result: unknown,
  options?: {
    target?: string
    model?: string
    tokenUsed?: number
  },
): void {
  const db = getDBSync()
  if (!db) return

  const now = Date.now()
  const ttl = CACHE_TTL[type] ?? 30 * 60 * 1000

  db.saveAIResult({
    id: `${type}:${options?.target ?? 'global'}:${now}`,
    type,
    target: options?.target ?? null,
    resultJson: JSON.stringify(result),
    model: options?.model ?? 'unknown',
    tokenUsed: options?.tokenUsed ?? 0,
    createdAt: now,
    expiresAt: now + ttl,
  })
}
