/**
 * 工贼检测 — Zustand Store
 */

import { create } from 'zustand'
import { getDBSync } from '@/lib/database'
import { runWasteAnalysis } from '@/ai/deepagent/run-analysis'
import { onActivity, type ActivityItem } from '@/ai/deepagent/activity-channel'
import type { AIConfig } from '@/stores/settings'
import type {
  WasteReport,
  WasteEvent,
  WasteScore,
  AnalysisProgress,
} from '@/ai/deepagent/types'

const TAG = '[WasteStore]'

/** 活动列表最大条数（防止内存膨胀） */
const MAX_ACTIVITIES = 200

interface WasteStore {
  // ---- 状态 ----
  report: WasteReport | null
  events: WasteEvent[]
  scores: WasteScore[]
  progress: AnalysisProgress | null
  isAnalyzing: boolean
  error: string | null

  /** 实时活动流 */
  activities: ActivityItem[]
  /** 分析开始时间（用于计算相对时间） */
  analysisStartedAt: number

  // ---- 操作 ----
  /** 启动深度分析 */
  startAnalysis: (config: AIConfig, repoPath: string) => Promise<void>

  /** 从数据库加载已有结果 */
  loadFromDB: () => void

  /** 获取某成员的事件 */
  getMemberEvents: (email: string) => WasteEvent[]

  /** 清除结果 */
  clear: () => void
}

export const useWasteStore = create<WasteStore>((set, get) => ({
  report: null,
  events: [],
  scores: [],
  progress: null,
  isAnalyzing: false,
  error: null,
  activities: [],
  analysisStartedAt: 0,

  startAnalysis: async (config, repoPath) => {
    console.log(`${TAG} ===== startAnalysis =====`)
    console.log(`${TAG} repoPath: ${repoPath}`)
    console.log(`${TAG} model: ${config.model}, provider: ${config.provider}`)

    const now = Date.now()
    set({ isAnalyzing: true, error: null, progress: null, activities: [], analysisStartedAt: now })

    // 订阅活动通道
    const unsubscribe = onActivity((item) => {
      set((state) => {
        const next = [...state.activities, item]
        // 超过上限时丢弃最旧的（但保留 phase 类型）
        if (next.length > MAX_ACTIVITIES) {
          return { activities: next.slice(-MAX_ACTIVITIES) }
        }
        return { activities: next }
      })
    })

    try {
      const report = await runWasteAnalysis(config, repoPath, (progress) => {
        console.log(`${TAG} progress: stage=${progress.stage}, ${progress.percent}%, events=${progress.eventsFound}, msg="${progress.message}"`)
        set({ progress })
      })

      console.log(`${TAG} 分析成功!`)
      console.log(`${TAG}   events: ${report.events.length}`)
      console.log(`${TAG}   ranking: ${report.ranking.length}`)
      console.log(`${TAG}   summary: ${report.summary.slice(0, 100)}...`)

      set({
        report,
        events: report.events,
        scores: report.ranking,
        isAnalyzing: false,
        progress: { stage: 'report', percent: 100, message: '分析完成', eventsFound: report.events.length },
      })
    } catch (err) {
      console.error(`${TAG} 分析失败:`, err)
      set({ error: (err as Error).message, isAnalyzing: false })
    } finally {
      unsubscribe()
    }
  },

  loadFromDB: () => {
    console.log(`${TAG} loadFromDB 开始...`)
    const db = getDBSync()
    if (!db) {
      console.warn(`${TAG} loadFromDB: 数据库未初始化`)
      return
    }

    try {
      // 检查表是否存在（v2 迁移可能尚未执行）
      const tableCheck = db.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='waste_analysis_runs'"
      )
      if (tableCheck.length === 0) {
        console.warn(`${TAG} loadFromDB: waste_analysis_runs 表不存在，跳过`)
        return
      }
      console.log(`${TAG} loadFromDB: 表存在，开始加载...`)

      // 加载最新分析结果
      const latestRun = db.getLatestWasteRun()
      console.log(`${TAG} loadFromDB: latestRun=${latestRun ? latestRun.id : 'null'}`)

      const rawEvents = db.getWasteEvents()
      console.log(`${TAG} loadFromDB: rawEvents=${rawEvents.length}`)

      const rawScores = db.getWasteScores()
      console.log(`${TAG} loadFromDB: rawScores=${rawScores.length}`)

      // 转换 DB 行为类型安全的对象
      const events: WasteEvent[] = rawEvents.map((e) => ({
        id: e.id,
        patternId: e.pattern_id as WasteEvent['patternId'],
        severity: e.severity as WasteEvent['severity'],
        authorEmail: e.author_email,
        relatedAuthors: JSON.parse(e.related_authors || '[]'),
        filePaths: JSON.parse(e.file_paths || '[]'),
        commitHashes: JSON.parse(e.commit_hashes || '[]'),
        linesWasted: e.lines_wasted,
        wasPassive: e.was_passive === 1,
        description: e.description || '',
        evidence: e.evidence || '',
        rootCause: e.root_cause || '',
        recommendation: e.recommendation || '',
        detectedAt: e.detected_at,
        analysisId: e.analysis_id,
      }))

      const scores: WasteScore[] = rawScores.map((s) => ({
        authorEmail: s.author_email,
        authorName: s.author_name || '',
        totalLinesAdded: s.total_lines_added,
        totalLinesWasted: s.total_lines_wasted,
        wasteRate: s.waste_rate,
        netEffectiveLines: s.net_effective_lines,
        wasteScore: s.waste_score,
        patternCounts: JSON.parse(s.pattern_counts || '{}'),
        topPattern: s.top_pattern || '',
        passiveWasteLines: s.passive_waste_lines,
      }))

      let report: WasteReport | null = null
      if (latestRun?.report_json) {
        try {
          report = JSON.parse(latestRun.report_json)
          console.log(`${TAG} loadFromDB: report 解析成功`)
        } catch {
          console.warn(`${TAG} loadFromDB: report_json 解析失败`)
        }
      }

      console.log(`${TAG} loadFromDB 完成: ${events.length} events, ${scores.length} scores, report=${!!report}`)
      set({ events, scores, report })
    } catch (err) {
      console.error(`${TAG} loadFromDB 出错:`, err)
    }
  },

  getMemberEvents: (email) => {
    return get().events.filter((e) => e.authorEmail === email)
  },

  clear: () => {
    console.log(`${TAG} clear 清除所有数据`)
    const db = getDBSync()
    if (db) {
      try {
        db.clearWasteData()
        console.log(`${TAG} clear: 数据库清除完成`)
      } catch (err) {
        console.warn(`${TAG} clear: 数据库清除失败`, err)
      }
    }
    set({ report: null, events: [], scores: [], progress: null, error: null, activities: [], analysisStartedAt: 0 })
  },
}))
