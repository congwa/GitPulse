/**
 * 工贼检测 — 类型定义
 */

/** 无用功模式 ID */
export type WastePatternId = 'W1' | 'W2' | 'W3' | 'W4' | 'W5' | 'W6' | 'W7'

/** 模式元信息 */
export const WASTE_PATTERNS: Record<WastePatternId, { name: string; emoji: string; description: string }> = {
  W1: { name: '代码蒸发', emoji: '💨', description: 'A 的代码被大量删除，新代码未复用旧逻辑' },
  W2: { name: '反复重写', emoji: '🔄', description: '同一文件短期内被同一人反复大改，方向不同' },
  W3: { name: '闪电回滚', emoji: '⚡', description: '提交后 30 分钟内回滚' },
  W4: { name: '先堆后拆', emoji: '📦', description: '大量代码堆到单文件后拆分，净变化接近零' },
  W5: { name: '破坏性简化', emoji: '💥', description: '"简化"删除了在用功能，导致他人需要修复' },
  W6: { name: '碎片化修复', emoji: '🩹', description: '功能需要 4+ 次连续 fix 才稳定' },
  W7: { name: '重复劳动', emoji: '👯', description: '多人未沟通做了相似工作，其中一人白做' },
}

/** 单个无用功事件 */
export interface WasteEvent {
  id?: number
  patternId: WastePatternId
  severity: 'high' | 'medium' | 'low'
  authorEmail: string
  relatedAuthors: string[]
  filePaths: string[]
  commitHashes: string[]
  linesWasted: number
  wasPassive: boolean
  description: string
  evidence: string
  rootCause: string
  recommendation: string
  detectedAt: number
  analysisId?: string
}

/** 成员浪费评分 */
export interface WasteScore {
  authorEmail: string
  authorName: string
  totalLinesAdded: number
  totalLinesWasted: number
  wasteRate: number
  netEffectiveLines: number
  wasteScore: number
  patternCounts: Record<string, number>
  topPattern: string
  passiveWasteLines: number
}

/** 完整分析报告 */
export interface WasteReport {
  analysisId: string
  generatedAt: number
  repoName: string
  summary: string
  ranking: WasteScore[]
  events: WasteEvent[]
  topIncidents: WasteEvent[]
  teamRecommendations: string[]
  analysisStats: {
    filesAnalyzed: number
    commitsScanned: number
    tokensUsed: number
    durationMs: number
  }
}

/** 分析进度 */
export interface AnalysisProgress {
  stage: 'pre-scan' | 'deep-analysis' | 'report'
  percent: number
  message: string
  currentFile?: string
  eventsFound: number
}

/** 预扫描结果 */
export interface ScanResult {
  /** 高频修改文件 */
  hotFiles: Array<{
    filePath: string
    totalChanges: number
    authorCount: number
    primaryOwner: string
  }>
  /** 嫌疑作者 (高删除比) */
  suspectAuthors: Array<{
    authorEmail: string
    authorName: string
    totalInsertions: number
    totalDeletions: number
    deleteRatio: number
  }>
  /** 代码接力异常 */
  hotHandoffs: Array<{
    fromAuthor: string
    toAuthor: string
    filePath: string
    handoffCount: number
  }>
  /** revert 提交 */
  reverts: Array<{
    hash: string
    authorEmail: string
    authorName: string
    timestamp: number
    message: string
  }>
}

/** Tauri execute 响应 */
export interface ExecuteResponse {
  stdout: string
  stderr: string
  exit_code: number
}

/** Tauri 文件信息 */
export interface TauriFileInfo {
  name: string
  path: string
  is_dir: boolean
  size: number
}

/** Tauri grep 匹配 */
export interface TauriGrepMatch {
  file: string
  line_number: number
  content: string
}
