/**
 * 团队洞察相关的 Zod Schemas
 */

import { z } from 'zod'

export const TeamInsightsSchema = z.object({
  insights: z
    .array(
      z.object({
        category: z
          .enum(['risk', 'highlight', 'trend', 'suggest'])
          .describe('洞察类别'),
        title: z.string().describe('洞察标题，不超过20字'),
        content: z.string().describe('详细说明'),
        relevantData: z.string().optional().describe('相关数据引用'),
      }),
    )
    .describe('3-5 条团队洞察'),
  teamHealthScore: z
    .number()
    .min(0)
    .max(100)
    .describe('团队健康度评分 0-100'),
})

export type TeamInsights = z.infer<typeof TeamInsightsSchema>
