/**
 * Task: 异常检测（结构化输出）
 */

import { createAgent } from 'langchain'
import { createStructuredAgentParams } from '../agent'
import { AnomalyReportSchema, type AnomalyReport } from '../schemas/dashboard'
import { ANOMALY_DETECTION_PROMPT } from '../prompts'
import type { AIConfig } from '@/stores/settings'

export async function getAnomalyReport(
  config: AIConfig,
): Promise<AnomalyReport> {
  const baseParams = createStructuredAgentParams(config, ANOMALY_DETECTION_PROMPT)

  const agent = createAgent({
    ...baseParams,
    responseFormat: AnomalyReportSchema,
  })

  const result = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: `请执行完整的异常检测：
1. 检测巴士因子（单人维护模块）
2. 检测提交节奏突变
3. 检测成员活跃度变化
4. 查看模块归属情况

给出所有检测到的异常、严重程度和建议。`,
      },
    ],
  })

  console.log('[AnomalyReport] Raw result:', JSON.stringify(result, null, 2))
  console.log('[AnomalyReport] structuredResponse:', result.structuredResponse)
  console.log('[AnomalyReport] messages:', result.messages)

  const structured = result.structuredResponse
  if (!structured || !Array.isArray(structured.anomalies)) {
    console.error('[AnomalyReport] Invalid structured data:', structured)
    throw new Error('AI 未返回有效的结构化数据 (AnomalyReport)')
  }
  return structured
}
