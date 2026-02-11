/**
 * Tool: 查询协作关系
 */

import { tool } from 'langchain'
import { z } from 'zod'
import { getDBSync } from '@/lib/database'

export const queryCollaboration = tool(
  async ({ minStrength }) => {
    const db = getDBSync()
    if (!db) return JSON.stringify({ error: '数据库未初始化' })

    const edges = db.getCollabEdges()
    const filtered = edges.filter((e) => e.strength >= minStrength)

    // 计算每个人的协作者数量
    const collabCount = new Map<string, number>()
    for (const e of edges) {
      collabCount.set(e.author_a, (collabCount.get(e.author_a) ?? 0) + 1)
      collabCount.set(e.author_b, (collabCount.get(e.author_b) ?? 0) + 1)
    }

    return JSON.stringify({
      edges: filtered.slice(0, 30),
      totalEdges: edges.length,
      filteredEdges: filtered.length,
      memberCollabCounts: Object.fromEntries(collabCount),
    })
  },
  {
    name: 'query_collaboration',
    description:
      '查询团队协作关系网络。返回成员之间的共同修改文件数和协作强度。' +
      '可设置最小强度阈值过滤弱关系。',
    schema: z.object({
      minStrength: z
        .number()
        .min(0)
        .max(1)
        .default(0.1)
        .describe('最小协作强度阈值 0-1'),
    }),
  },
)
