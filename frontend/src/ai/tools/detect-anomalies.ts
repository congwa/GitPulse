/**
 * Tool: 异常检测
 */

import { tool } from 'langchain'
import { z } from 'zod'
import { getDBSync } from '@/lib/database'

export const detectAnomalies = tool(
  async ({ categories }) => {
    const db = getDBSync()
    if (!db) return JSON.stringify({ error: '数据库未初始化' })

    const anomalies: Array<{
      category: string
      severity: 'high' | 'medium' | 'low'
      detail: string
      data: unknown
    }> = []

    // 巴士因子：只有 1 个人维护的模块
    if (categories.includes('bus_factor')) {
      const modules = db.getModuleOwnership()
      const singleOwner = modules.filter((m) => m.total_files <= 1)
      if (singleOwner.length > 0) {
        anomalies.push({
          category: 'bus_factor',
          severity: singleOwner.length > 3 ? 'high' : 'medium',
          detail: `${singleOwner.length} 个模块仅由 1 人维护`,
          data: singleOwner.slice(0, 10).map((m) => ({
            directory: m.directory,
            owner: m.owner_name || m.owner_email,
            commits: m.total_commits,
          })),
        })
      }
    }

    // 提交节奏异常
    if (categories.includes('rhythm')) {
      const dateStats = db.getDateStats(60)
      if (dateStats.length > 14) {
        const recent7 = dateStats.slice(0, 7)
        const prev7 = dateStats.slice(7, 14)
        const recentAvg =
          recent7.reduce((s, d) => s + d.total_commits, 0) / 7
        const prevAvg =
          prev7.reduce((s, d) => s + d.total_commits, 0) / 7

        if (prevAvg > 0) {
          const change = ((recentAvg - prevAvg) / prevAvg) * 100
          if (Math.abs(change) > 50) {
            anomalies.push({
              category: 'rhythm',
              severity: Math.abs(change) > 80 ? 'high' : 'medium',
              detail: `近 7 天平均提交 ${recentAvg.toFixed(1)} 次/天，相比前一周 ${change > 0 ? '增加' : '减少'} ${Math.abs(change).toFixed(0)}%`,
              data: { recentAvg, prevAvg, changePercent: change },
            })
          }
        }
      }
    }

    // 成员活跃度异常
    if (categories.includes('member_activity')) {
      const authors = db.getAuthorStats()
      const now = Date.now()
      const inactive = authors.filter(
        (a) => a.total_commits > 10 && now - a.last_commit_at > 30 * 86400000,
      )
      if (inactive.length > 0) {
        anomalies.push({
          category: 'member_activity',
          severity: inactive.length > 2 ? 'medium' : 'low',
          detail: `${inactive.length} 个活跃成员近 30 天无提交`,
          data: inactive.map((a) => ({
            name: a.author_name,
            totalCommits: a.total_commits,
            lastCommit: new Date(a.last_commit_at).toISOString().split('T')[0],
          })),
        })
      }
    }

    return JSON.stringify({ anomalies, checkedCategories: categories })
  },
  {
    name: 'detect_anomalies',
    description:
      '检测仓库中的异常模式。支持三类检测：bus_factor（巴士因子/单人维护模块）、' +
      'rhythm（提交节奏突变）、member_activity（成员活跃度变化）。',
    schema: z.object({
      categories: z
        .array(z.enum(['bus_factor', 'rhythm', 'member_activity']))
        .describe('要检测的异常类别'),
    }),
  },
)
