/**
 * Tool: 查询模块归属信息
 */

import { tool } from 'langchain'
import { z } from 'zod'
import { getDBSync } from '@/lib/database'

export const queryModuleOwnership = tool(
  async ({ directory }) => {
    const db = getDBSync()
    if (!db) return JSON.stringify({ error: '数据库未初始化' })

    const modules = db.getModuleOwnership()

    if (directory) {
      const mod = modules.find(
        (m) => m.directory === directory || m.directory.includes(directory),
      )
      if (!mod) {
        return JSON.stringify({ error: `未找到模块: ${directory}` })
      }
      return JSON.stringify({ module: mod })
    }

    // 返回所有模块概览
    return JSON.stringify({
      modules: modules.slice(0, 30), // 控制 token
      totalModules: modules.length,
    })
  },
  {
    name: 'query_module_ownership',
    description:
      '查询代码模块归属信息。返回每个目录的提交数、文件数、主要负责人、热度等。' +
      '可指定目录名查看详情，不传则返回所有模块列表。',
    schema: z.object({
      directory: z
        .string()
        .optional()
        .describe('目录路径，不传则返回所有模块'),
    }),
  },
)
