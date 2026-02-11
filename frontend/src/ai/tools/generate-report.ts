/**
 * Tool: 生成分析报告数据
 */

import { tool } from 'langchain'
import { z } from 'zod'
import { getDBSync } from '@/lib/database'

export const generateReport = tool(
  async ({ sections }) => {
    const db = getDBSync()
    if (!db) return JSON.stringify({ error: '数据库未初始化' })

    const report: Record<string, unknown> = {}

    if (sections.includes('overview')) {
      report.overview = db.getDashboardStats()
    }

    if (sections.includes('team')) {
      const authors = db.getAuthorStats()
      report.team = {
        totalMembers: authors.length,
        topContributors: authors.slice(0, 5).map((a) => ({
          name: a.author_name,
          commits: a.total_commits,
          activeDays: a.active_days,
        })),
      }
    }

    if (sections.includes('modules')) {
      const modules = db.getModuleOwnership()
      report.modules = {
        totalModules: modules.length,
        hotModules: modules.slice(0, 10).map((m) => ({
          directory: m.directory,
          commits: m.total_commits,
          owner: m.owner_name || m.owner_email,
        })),
      }
    }

    if (sections.includes('trend')) {
      const dateStats = db.getDateStats(30)
      const typeSummary = db.getCommitTypeSummary()
      report.trend = {
        recent30Days: dateStats,
        commitTypes: typeSummary,
      }
    }

    if (sections.includes('collaboration')) {
      const edges = db.getCollabEdges()
      report.collaboration = {
        totalEdges: edges.length,
        strongPairs: edges
          .filter((e) => e.strength > 0.5)
          .slice(0, 10)
          .map((e) => ({
            pair: `${e.author_a} ↔ ${e.author_b}`,
            sharedFiles: e.shared_files,
            strength: e.strength,
          })),
      }
    }

    return JSON.stringify(report)
  },
  {
    name: 'generate_report',
    description:
      '生成仓库分析报告数据。可选择包含的章节：overview（概览）、team（团队）、' +
      'modules（模块）、trend（趋势）、collaboration（协作）。',
    schema: z.object({
      sections: z
        .array(
          z.enum([
            'overview',
            'team',
            'modules',
            'trend',
            'collaboration',
          ]),
        )
        .describe('要包含的报告章节'),
    }),
  },
)
