/**
 * Dashboard 相关的 Zod Schemas（用于 responseFormat）
 */

import { z } from 'zod'

export const DashboardSummarySchema = z.object({
  summary: z.string().describe('一句话总结，不超过80字'),
  highlights: z
    .array(
      z.object({
        metric: z.string().describe('指标名称'),
        value: z.string().describe('指标值'),
        trend: z.enum(['up', 'down', 'stable']).describe('趋势方向'),
      }),
    )
    .describe('3-4 个关键指标亮点'),
})

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>

export const AnomalyReportSchema = z.object({
  anomalies: z
    .array(
      z.object({
        title: z.string().describe('异常标题'),
        severity: z.enum(['high', 'medium', 'low']).describe('严重程度'),
        description: z.string().describe('异常描述'),
        suggestion: z.string().describe('改进建议'),
      }),
    )
    .describe('检测到的异常列表'),
  overallRisk: z
    .enum(['high', 'medium', 'low', 'none'])
    .describe('整体风险等级'),
})

export type AnomalyReport = z.infer<typeof AnomalyReportSchema>
