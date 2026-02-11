/**
 * Tool: 查询成员档案详情
 */

import { tool } from 'langchain'
import { z } from 'zod'
import { getDBSync } from '@/lib/database'

export const queryMemberProfile = tool(
  async ({ email, timeRange }) => {
    const db = getDBSync()
    if (!db) return JSON.stringify({ error: '数据库未初始化' })

    // 获取 Git 提交记录的实际时间范围
    const commitTimeRange = db.getCommitTimeRange()
    if (!commitTimeRange) {
      return JSON.stringify({ error: '暂无提交记录' })
    }

    // 计算时间范围（基于 Git 提交时间，而非当前时间）
    const rangeMs: Record<string, number> = {
      '7d': 7 * 86400000,
      '30d': 30 * 86400000,
      '90d': 90 * 86400000,
      '180d': 180 * 86400000,
      '365d': 365 * 86400000,
      all: Infinity,
    }
    const rangeDuration = rangeMs[timeRange || 'all'] ?? Infinity

    // 根据是否有时间范围选择查询方式
    let allAuthors
    let startDate: string | null = null
    let endDate: string | null = null

    if (timeRange && timeRange !== 'all' && rangeDuration !== Infinity) {
      // 以最新 Git 提交时间为基准，向前推算
      const endTs = commitTimeRange.maxTs
      const startTs = endTs - rangeDuration
      allAuthors = db.getAuthorStatsByDateRange(startTs, endTs)
      startDate = new Date(startTs).toISOString().split('T')[0]
      endDate = new Date(endTs).toISOString().split('T')[0]
    } else {
      allAuthors = db.getAuthorStats()
      // 全量数据时，显示完整的 Git 记录时间范围
      startDate = new Date(commitTimeRange.minTs).toISOString().split('T')[0]
      endDate = new Date(commitTimeRange.maxTs).toISOString().split('T')[0]
    }

    if (email) {
      const author = allAuthors.find((a) => a.author_email === email)
      if (!author) return JSON.stringify({ error: `未找到成员: ${email}` })

      // 获取该成员的工作时间热力图
      const heatmap = db.getAuthorHeatmap(email)

      return JSON.stringify({
        profile: author,
        heatmap: heatmap.slice(0, 50), // 控制 token
      })
    }

    // 没指定 email，返回所有成员概览（多维度贡献数据）
    // 计算各维度最大值用于归一化
    const maxCommits = Math.max(...allAuthors.map(a => a.total_commits), 1)
    const maxInsertions = Math.max(...allAuthors.map(a => a.total_insertions), 1)
    const maxDeletions = Math.max(...allAuthors.map(a => a.total_deletions), 1)
    const maxFiles = Math.max(...allAuthors.map(a => a.files_touched), 1)
    const maxActiveDays = Math.max(...allAuthors.map(a => a.active_days), 1)

    return JSON.stringify({
      members: allAuthors.map((a) => {
        // 多维度贡献评分（满分100）
        // 权重: 代码量40% + 提交数20% + 文件覆盖15% + 活跃天数15% + 代码删除10%
        const codeScore = (a.total_insertions / maxInsertions) * 40
        const commitScore = (a.total_commits / maxCommits) * 20
        const fileScore = (a.files_touched / maxFiles) * 15
        const activeScore = (a.active_days / maxActiveDays) * 15
        const cleanupScore = (a.total_deletions / maxDeletions) * 10
        const contributionScore = Math.round(codeScore + commitScore + fileScore + activeScore + cleanupScore)

        return {
          email: a.author_email,
          name: a.author_name,
          // 多维度数据
          totalCommits: a.total_commits,
          totalInsertions: a.total_insertions,
          totalDeletions: a.total_deletions,
          filesTouched: a.files_touched,
          activeDays: a.active_days,
          avgCommitSize: a.avg_commit_size,
          // 综合贡献评分
          contributionScore,
          // 活跃周期
          firstCommitAt: a.first_commit_at,
          lastCommitAt: a.last_commit_at,
        }
      }),
      // 说明评分维度
      scoringCriteria: {
        description: '综合贡献评分基于多维度加权计算，避免单一维度刷数据',
        weights: {
          codeInsertions: '40% - 代码新增行数',
          commits: '20% - 提交次数',
          filesTouched: '15% - 涉及文件数',
          activeDays: '15% - 活跃天数',
          codeDeletions: '10% - 代码删除/重构',
        },
      },
      // 日期范围信息
      dateRange: timeRange && timeRange !== 'all' ? { startDate, endDate } : null,
      timeRange: timeRange || 'all',
    })
  },
  {
    name: 'query_member_profile',
    description:
      '查询团队成员档案。支持按时间范围筛选（如周报用7d，月报用30d）。' +
      '返回多维度贡献数据和综合贡献评分（contributionScore），避免单一提交数造成的偏差。',
    schema: z.object({
      email: z
        .string()
        .optional()
        .describe('成员邮箱，不传则返回所有成员列表'),
      timeRange: z
        .enum(['7d', '30d', '90d', '180d', '365d', 'all'])
        .optional()
        .describe('时间范围：7d=周报，30d=月报，all=全量历史（默认）'),
    }),
  },
)
