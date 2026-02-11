/**
 * Tool: 查询提交统计数据
 */

import { tool } from 'langchain'
import { z } from 'zod'
import { getDBSync } from '@/lib/database'

export const queryCommitStats = tool(
  async ({ timeRange, groupBy }) => {
    const db = getDBSync()
    if (!db) return JSON.stringify({ error: '数据库未初始化' })

    // 获取 Git 提交记录的实际时间范围
    const commitTimeRange = db.getCommitTimeRange()
    if (!commitTimeRange) {
      return JSON.stringify({ error: '暂无提交记录' })
    }

    const dashboardStats = db.getDashboardStats()
    const dateStats = db.getDateStats()

    // 按 timeRange 过滤日期统计（基于 Git 提交时间，而非当前时间）
    const rangeMs: Record<string, number> = {
      '7d': 7 * 86400000,
      '30d': 30 * 86400000,
      '90d': 90 * 86400000,
      '180d': 180 * 86400000,
      '365d': 365 * 86400000,
      all: Infinity,
    }
    const rangeDuration = rangeMs[timeRange] ?? Infinity

    let filtered
    let startDate: string | null = null
    let endDate: string | null = null

    if (timeRange !== 'all' && rangeDuration !== Infinity) {
      // 以最新 Git 提交时间为基准，向前推算
      const latestCommitDate = new Date(commitTimeRange.maxTs)
      const cutoffDate = new Date(commitTimeRange.maxTs - rangeDuration)
      const cutoffStr = cutoffDate.toISOString().split('T')[0]

      filtered = dateStats.filter((d) => d.date >= cutoffStr)

      // 计算实际日期范围
      const dates = filtered.map(d => d.date).sort()
      startDate = dates[0] || cutoffStr
      endDate = dates[dates.length - 1] || latestCommitDate.toISOString().split('T')[0]
    } else {
      filtered = dateStats
      // 全量数据时，使用完整的 Git 记录时间范围
      startDate = new Date(commitTimeRange.minTs).toISOString().split('T')[0]
      endDate = new Date(commitTimeRange.maxTs).toISOString().split('T')[0]
    }

    // 按 groupBy 聚合
    if (groupBy === 'author') {
      // 如果有时间范围，使用按时间筛选的作者统计
      let authorStats
      if (timeRange !== 'all' && rangeDuration !== Infinity) {
        const endTs = commitTimeRange.maxTs
        const startTs = endTs - rangeDuration
        authorStats = db.getAuthorStatsByDateRange(startTs, endTs)
      } else {
        authorStats = db.getAuthorStats()
      }

      return JSON.stringify({
        summary: dashboardStats,
        byAuthor: authorStats.slice(0, 20),
        timeRange,
        dateRange: { startDate, endDate },
      })
    }

    return JSON.stringify({
      summary: dashboardStats,
      trend: filtered.slice(0, 30), // 最多返回 30 条（控制 token）
      groupBy,
      timeRange,
      dateRange: { startDate, endDate },
    })
  },
  {
    name: 'query_commit_stats',
    description:
      '查询仓库提交统计数据。可按时间范围筛选，按 day/week/month/author 分组。' +
      '返回提交数、增删行数、活跃成员数等聚合数据。',
    schema: z.object({
      timeRange: z
        .enum(['7d', '30d', '90d', '180d', '365d', 'all'])
        .describe('时间范围'),
      groupBy: z
        .enum(['day', 'week', 'month', 'author'])
        .describe('分组维度'),
    }),
  },
)
