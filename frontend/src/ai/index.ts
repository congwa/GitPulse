/**
 * GitPulse AI 模块 — 统一导出
 *
 * 外部使用时统一从 @/ai 导入
 */

// Agent
export { createGitPulseAgent, createStructuredAgentParams } from './agent'

// Model Factory
export { createModel } from './model-factory'

// Tools
export { allTools } from './tools'
export {
  queryCommitStats,
  queryMemberProfile,
  queryModuleOwnership,
  queryTimePattern,
  queryCollaboration,
  detectAnomalies,
  generateReport,
} from './tools'

// Tasks — 结构化输出
export { getDashboardSummary } from './tasks/dashboard-summary'
export { getMemberTags, getAllMemberTags } from './tasks/member-tags'
export { getTeamInsights } from './tasks/team-insights'
export { getAnomalyReport } from './tasks/anomaly-detection'

// Tasks — 流式
export { streamChat, type ChatStreamChunk } from './tasks/chat'
export { streamMemberPortrait } from './tasks/member-portrait'
export { streamReport, type ReportType } from './tasks/report'

// Schemas
export { DashboardSummarySchema, type DashboardSummary } from './schemas/dashboard'
export { AnomalyReportSchema, type AnomalyReport } from './schemas/dashboard'
export { MemberTagsSchema, type MemberTags } from './schemas/member'
export { MemberBatchTagsSchema, type MemberBatchTags } from './schemas/member'
export { TeamInsightsSchema, type TeamInsights } from './schemas/insights'

// Cache
export { getCachedResult, setCachedResult } from './cache'

// Error handling
export { AIError, handleAIError, type AIErrorCode } from './error-handler'

// Prompts
export { SYSTEM_PROMPT } from './prompts'
