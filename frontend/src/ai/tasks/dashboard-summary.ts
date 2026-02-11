/**
 * Task: Dashboard 概况一句话总结（结构化输出）
 */

import { createAgent } from 'langchain'
import { createStructuredAgentParams } from '../agent'
import { DashboardSummarySchema, type DashboardSummary } from '../schemas/dashboard'
import { DASHBOARD_SUMMARY_PROMPT } from '../prompts'
import type { AIConfig } from '@/stores/settings'

export async function getDashboardSummary(
  config: AIConfig,
): Promise<DashboardSummary> {
  const baseParams = createStructuredAgentParams(config, DASHBOARD_SUMMARY_PROMPT)

  const agent = createAgent({
    ...baseParams,
    responseFormat: DashboardSummarySchema,
  })

  const result = await agent.invoke({
    messages: [
      {
        role: 'user',
        content:
          '请查询最近 90 天的提交统计数据和团队成员信息，给出项目概况的一句话总结和 3-4 个关键指标亮点。',
      },
    ],
  })

  console.log('[DashboardSummary] Raw result:', JSON.stringify(result, null, 2))
  console.log('[DashboardSummary] structuredResponse:', result.structuredResponse)
  console.log('[DashboardSummary] messages:', result.messages)

  const structured = result.structuredResponse
  if (!structured || typeof structured.summary !== 'string') {
    console.error('[DashboardSummary] Invalid structured data:', structured)
    throw new Error('AI 未返回有效的结构化数据 (DashboardSummary)')
  }
  return structured
}
