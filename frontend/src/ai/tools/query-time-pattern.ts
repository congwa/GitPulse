/**
 * Tool: 查询工作时间模式
 */

import { tool } from 'langchain'
import { z } from 'zod'
import { getDBSync } from '@/lib/database'

export const queryTimePattern = tool(
  async ({ scope }) => {
    const db = getDBSync()
    if (!db) return JSON.stringify({ error: '数据库未初始化' })

    if (scope === 'team') {
      const heatmap = db.getTeamHeatmap()
      return JSON.stringify({
        scope: 'team',
        heatmap,
        description:
          '团队整体工作时间分布（星期 x 小时热力图）',
      })
    }

    // 个人模式：返回所有成员的概要
    const authors = db.getAuthorStats()
    const result = []
    for (const author of authors.slice(0, 10)) {
      const heatmap = db.getAuthorHeatmap(author.author_email)
      // 计算峰值时间
      const peak = heatmap.reduce(
        (max, h) => (h.commit_count > max.commit_count ? h : max),
        { day_of_week: 0, hour_of_day: 0, commit_count: 0 },
      )
      result.push({
        email: author.author_email,
        name: author.author_name,
        peakDay: peak.day_of_week,
        peakHour: peak.hour_of_day,
        peakCommits: peak.commit_count,
      })
    }

    return JSON.stringify({
      scope: 'individuals',
      members: result,
    })
  },
  {
    name: 'query_time_pattern',
    description:
      '查询工作时间模式。team 返回团队整体热力图；individual 返回各成员峰值工作时间。',
    schema: z.object({
      scope: z
        .enum(['team', 'individual'])
        .describe('查看团队整体还是个人'),
    }),
  },
)
