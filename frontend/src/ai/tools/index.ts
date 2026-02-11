/**
 * GitPulse AI Tools — 统一导出
 */

export { queryCommitStats } from './query-commit-stats'
export { queryMemberProfile } from './query-member-profile'
export { queryModuleOwnership } from './query-module-ownership'
export { queryTimePattern } from './query-time-pattern'
export { queryCollaboration } from './query-collaboration'
export { detectAnomalies } from './detect-anomalies'
export { generateReport } from './generate-report'

import { queryCommitStats } from './query-commit-stats'
import { queryMemberProfile } from './query-member-profile'
import { queryModuleOwnership } from './query-module-ownership'
import { queryTimePattern } from './query-time-pattern'
import { queryCollaboration } from './query-collaboration'
import { detectAnomalies } from './detect-anomalies'
import { generateReport } from './generate-report'

/** 所有 Tools 数组 — 传给 createAgent */
export const allTools = [
  queryCommitStats,
  queryMemberProfile,
  queryModuleOwnership,
  queryTimePattern,
  queryCollaboration,
  detectAnomalies,
  generateReport,
]
