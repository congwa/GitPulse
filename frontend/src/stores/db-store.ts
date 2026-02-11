/**
 * GitPulse Database-backed Store
 *
 * 统一的 Zustand store，所有数据从 SQLite 读取
 */

import { create } from 'zustand'
import { getDBSync, type GitPulseDB } from '@/lib/database'

// ============================================
// Types
// ============================================

export interface AuthorStat {
  email: string
  name: string
  totalCommits: number
  insertions: number
  deletions: number
  filesTouched: number
  firstCommit: string
  lastCommit: string
  activeDays: number
  avgCommitSize: number
  tags: { label: string; type: string }[]
  portrait: string | null
  commitTypes: Record<string, number>
  radarData: number[]
  topDirs: string[]
}

export interface DashboardStats {
  totalCommits: number
  activeMembers: number
  filesInvolved: number
  codeLines: number
}

export interface InsightItem {
  id: string
  title: string
  description: string
  category: 'risk' | 'highlight' | 'trend' | 'suggest'
  severity: number
}

export interface ModuleItem {
  directory: string
  totalCommits: number
  totalFiles: number
  ownerEmail: string
  ownerName: string
  heat: number
}

export interface HeatmapCell {
  hour: number
  day: number
  value: number
}

export interface RecentCommit {
  hash: string
  authorName: string
  authorEmail: string
  timestamp: number
  message: string
  commitType: string
}

export interface CollabEdge {
  authorA: string
  authorB: string
  sharedFiles: number
  strength: number
}

export interface WeeklyCommit {
  week: string
  commits: number
}

export interface CommitTypeCount {
  name: string
  value: number
}

export interface RepoMeta {
  path: string
  name: string
  lastAnalyzed: number | null
  totalCommits: number
  totalAuthors: number
  status: string
}

// ============================================
// Store State
// ============================================

interface DBStoreState {
  // 加载状态
  isLoaded: boolean
  isLoading: boolean
  error: string | null

  // 从 SQLite 加载的数据
  dashboardStats: DashboardStats
  authorStats: AuthorStat[]
  weeklyCommits: WeeklyCommit[]
  commitTypes: CommitTypeCount[]
  teamHeatmap: HeatmapCell[]
  modules: ModuleItem[]
  insights: InsightItem[]
  aiSummary: string
  collabEdges: CollabEdge[]
  recentCommits: RecentCommit[]
  repoMetas: RepoMeta[]
  dbSize: number // 缓存 DB 大小，避免渲染时调用 db.export()

  // 操作
  loadFromDB: () => Promise<void>
  refresh: () => Promise<void>
  deleteRepo: (repoPath: string) => Promise<void>
  getAuthorByEmail: (email: string) => AuthorStat | undefined
  getAuthorHeatmap: (email: string) => HeatmapCell[]
  getPersonalCommits: (email: string) => RecentCommit[]
  getPortrait: (email: string) => string | null
}

// ============================================
// Helper: 从 DB 读取数据
// ============================================

function loadDashboardStats(db: GitPulseDB): DashboardStats {
  return db.getDashboardStats()
}

function loadAuthorStats(db: GitPulseDB): AuthorStat[] {
  const rows = db.getAuthorStats()
  if (rows.length === 0) return []

  // —— 批量预查，消除 N+1 ——

  // 1. 批量获取所有 member_tags AI 结果
  const allTagsResults = db.query<{ target: string; result_json: string }>(
    "SELECT target, result_json FROM ai_results WHERE type = 'member_tags'"
  )
  const tagsMap = new Map<string, { label: string; type: string }[]>()
  for (const row of allTagsResults) {
    if (!row.target) continue
    try {
      const parsed = JSON.parse(row.result_json) as { tags: { label: string; type: string }[] }
      tagsMap.set(row.target, parsed.tags)
    } catch { /* ignore parse errors */ }
  }

  // 2. 批量获取所有 member_portrait AI 结果
  const allPortraitResults = db.query<{ target: string; result_json: string }>(
    "SELECT target, result_json FROM ai_results WHERE type = 'member_portrait'"
  )
  const portraitMap = new Map<string, string>()
  for (const row of allPortraitResults) {
    if (!row.target) continue
    try {
      const parsed = JSON.parse(row.result_json) as { portrait: string }
      portraitMap.set(row.target, parsed.portrait)
    } catch { /* ignore parse errors */ }
  }

  // 3. 批量获取所有作者的 commit type 分布（一条 SQL）
  const allCommitTypes = db.query<{ author_email: string; commit_type: string; cnt: number }>(
    "SELECT author_email, commit_type, COUNT(*) as cnt FROM raw_commits GROUP BY author_email, commit_type"
  )
  const commitTypesMap = new Map<string, Record<string, number>>()
  for (const row of allCommitTypes) {
    if (!commitTypesMap.has(row.author_email)) {
      commitTypesMap.set(row.author_email, {})
    }
    commitTypesMap.get(row.author_email)![row.commit_type] = row.cnt
  }

  // 4. 批量获取所有作者的 top 3 目录（使用窗口函数或排序后取前 3）
  // SQLite 不支持窗口函数的 ROW_NUMBER，使用子查询方式
  const allTopDirs = db.query<{ author_email: string; directory: string; commits: number }>(
    "SELECT author_email, directory, commits FROM stats_module_ownership ORDER BY author_email, commits DESC"
  )
  const topDirsMap = new Map<string, string[]>()
  for (const row of allTopDirs) {
    if (!topDirsMap.has(row.author_email)) {
      topDirsMap.set(row.author_email, [])
    }
    const dirs = topDirsMap.get(row.author_email)!
    if (dirs.length < 3) {
      dirs.push(row.directory)
    }
  }

  // —— 预计算雷达图的归一化参数 ——
  const totalTeamCommits = rows.reduce((s, x) => s + x.total_commits, 0)
  const maxInsertions = Math.max(1, ...rows.map((x) => x.total_insertions))
  const maxFilesTouched = Math.max(1, ...rows.map((x) => x.files_touched))
  const maxAvgSize = Math.max(1, ...rows.map((x) => x.avg_commit_size))
  const maxActiveDays = Math.max(1, ...rows.map((x) => x.active_days))

  return rows.map((r) => {
    // 从预查的 Map 中获取数据，O(1) 无 DB 调用
    const tags = tagsMap.get(r.author_email) ?? []
    const portrait = portraitMap.get(r.author_email) ?? null
    const commitTypes = commitTypesMap.get(r.author_email) ?? {}
    const topDirs = topDirsMap.get(r.author_email) ?? []

    // 雷达数据计算
    const commitFreq = totalTeamCommits > 0
      ? Math.min(100, Math.round((r.total_commits / totalTeamCommits) * 300))
      : 0
    const codeVolume = Math.min(100, Math.round((r.total_insertions / maxInsertions) * 100))
    const moduleBreadth = Math.min(100, Math.round((r.files_touched / maxFilesTouched) * 100))
    const survivalRate = r.total_insertions > 0
      ? Math.min(100, Math.max(0, Math.round(((r.total_insertions - r.total_deletions) / r.total_insertions) * 100)))
      : 0
    const msgQuality = Math.min(100, Math.round((r.avg_commit_size / maxAvgSize) * 100))
    const collabIdx = Math.min(100, Math.round((r.active_days / maxActiveDays) * 100))
    const radarData = [commitFreq, codeVolume, moduleBreadth, survivalRate, msgQuality, collabIdx]

    return {
      email: r.author_email,
      name: r.author_name,
      totalCommits: r.total_commits,
      insertions: r.total_insertions,
      deletions: r.total_deletions,
      filesTouched: r.files_touched,
      firstCommit: new Date(r.first_commit_at).toISOString().slice(0, 10),
      lastCommit: new Date(r.last_commit_at).toISOString().slice(0, 10),
      activeDays: r.active_days,
      avgCommitSize: r.avg_commit_size,
      tags,
      portrait,
      commitTypes,
      radarData,
      topDirs,
    }
  })
}

function loadWeeklyCommits(db: GitPulseDB): WeeklyCommit[] {
  // 按日期聚合为周
  const rows = db.query<{ date: string; total_commits: number }>(
    "SELECT date, total_commits FROM stats_by_date ORDER BY date DESC LIMIT 84"
  )

  const weekMap = new Map<string, number>()
  rows.forEach((r) => {
    const d = new Date(r.date)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const weekKey = `W${weekStart.toISOString().slice(5, 10)}`
    weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + r.total_commits)
  })

  return Array.from(weekMap.entries())
    .map(([week, commits]) => ({ week, commits }))
    .reverse()
    .slice(-12)
}

function loadCommitTypes(db: GitPulseDB): CommitTypeCount[] {
  const rows = db.getCommitTypeSummary()
  return rows.map((r) => ({
    name: r.commit_type,
    value: r.total,
  }))
}

function loadTeamHeatmap(db: GitPulseDB): HeatmapCell[] {
  const rows = db.getTeamHeatmap()
  return rows.map((r) => ({
    hour: r.hour_of_day,
    day: r.day_of_week,
    value: r.commit_count,
  }))
}

function loadModules(db: GitPulseDB): ModuleItem[] {
  const rows = db.getModuleOwnership()
  return rows.map((r) => ({
    directory: r.directory,
    totalCommits: r.total_commits,
    totalFiles: r.total_files,
    ownerEmail: r.owner_email,
    ownerName: r.owner_name ?? 'Unknown',
    heat: r.heat,
  }))
}

function loadInsights(db: GitPulseDB): InsightItem[] {
  const result = db.getAIResult('insights')
  if (!result) return []
  const parsed = JSON.parse(result.result_json) as {
    insights: Array<{
      id?: string
      title: string
      content?: string
      description?: string
      category: 'risk' | 'highlight' | 'trend' | 'suggest'
      severity?: number
      relevantData?: string
    }>
  }
  return (parsed.insights || []).map((ins, i) => ({
    id: ins.id ?? `insight-${i}`,
    title: ins.title,
    description: ins.description || ins.content || '',
    category: ins.category,
    severity: ins.severity ?? (ins.category === 'risk' ? 4 : ins.category === 'highlight' ? 3 : 2),
  }))
}

function loadAISummary(db: GitPulseDB): string {
  const result = db.getAIResult('project_summary')
  if (!result) return ''
  const parsed = JSON.parse(result.result_json) as { summary: string }
  return parsed.summary
}

function loadCollabEdges(db: GitPulseDB): CollabEdge[] {
  const rows = db.getCollabEdges()
  return rows.map((r) => ({
    authorA: r.author_a,
    authorB: r.author_b,
    sharedFiles: r.shared_files,
    strength: r.strength,
  }))
}

function loadRecentCommits(db: GitPulseDB): RecentCommit[] {
  return db.getRecentCommits(30).map((r) => ({
    hash: r.hash.slice(0, 7),
    authorName: r.author_name,
    authorEmail: r.author_email,
    timestamp: r.timestamp,
    message: r.message,
    commitType: r.commit_type,
  }))
}

function loadRepoMetas(db: GitPulseDB): RepoMeta[] {
  return db.getAllRepoMetas().map((r) => ({
    path: r.repo_path,
    name: r.repo_name,
    lastAnalyzed: r.last_analyzed,
    totalCommits: r.total_commits,
    totalAuthors: r.total_authors,
    status: r.status,
  }))
}

/** 让出主线程，让 React 有机会重新渲染 */
function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

// ============================================
// Store
// ============================================

export const useDBStore = create<DBStoreState>()((set, get) => ({
  isLoaded: false,
  isLoading: false,
  error: null,

  dashboardStats: { totalCommits: 0, activeMembers: 0, filesInvolved: 0, codeLines: 0 },
  authorStats: [],
  weeklyCommits: [],
  commitTypes: [],
  teamHeatmap: [],
  modules: [],
  insights: [],
  aiSummary: '',
  collabEdges: [],
  recentCommits: [],
  repoMetas: [],
  dbSize: 0,

  loadFromDB: async () => {
    const db = getDBSync()
    if (!db) {
      set({ error: 'Database not initialized' })
      return
    }

    set({ isLoading: true })
    try {
      // —— 分片加载：先加载首屏必要数据（立即可见）——
      set({ dashboardStats: loadDashboardStats(db), repoMetas: loadRepoMetas(db) })
      await yieldToUI()

      // —— 加载作者统计（可能较耗时）——
      set({ authorStats: loadAuthorStats(db) })
      await yieldToUI()

      // —— 加载周提交和类型统计 ——
      set({ weeklyCommits: loadWeeklyCommits(db), commitTypes: loadCommitTypes(db) })
      await yieldToUI()

      // —— 加载热力图和模块 ——
      set({ teamHeatmap: loadTeamHeatmap(db), modules: loadModules(db) })
      await yieldToUI()

      // —— 加载 AI 洞察和总结 ——
      set({ insights: loadInsights(db), aiSummary: loadAISummary(db) })
      await yieldToUI()

      // —— 加载协作边和最近提交 ——
      set({ collabEdges: loadCollabEdges(db), recentCommits: loadRecentCommits(db) })
      await yieldToUI()

      // —— 计算并缓存 DB 大小 ——
      set({ dbSize: db.getSize() })

      set({ isLoaded: true, isLoading: false, error: null })
      console.log('[DBStore] Data loaded from SQLite (chunked)')
    } catch (err) {
      set({ error: String(err), isLoading: false })
      console.error('[DBStore] Failed to load:', err)
    }
  },

  refresh: async () => {
    await get().loadFromDB()
  },

  deleteRepo: async (repoPath: string) => {
    const db = getDBSync()
    if (!db) return
    await db.deleteRepoFull(repoPath)
    await get().loadFromDB()
    console.log(`[DBStore] Deleted repo: ${repoPath}`)
  },

  getAuthorByEmail: (email: string) => {
    return get().authorStats.find((a) => a.email === email)
  },

  getAuthorHeatmap: (email: string) => {
    const db = getDBSync()
    if (!db) return []
    return db.getAuthorHeatmap(email).map((r) => ({
      hour: r.hour_of_day,
      day: r.day_of_week,
      value: r.commit_count,
    }))
  },

  getPersonalCommits: (email: string) => {
    const db = getDBSync()
    if (!db) return []
    return db.query<{
      hash: string; author_name: string; author_email: string;
      timestamp: number; message: string; commit_type: string
    }>(
      "SELECT hash, author_name, author_email, timestamp, message, commit_type FROM raw_commits WHERE author_email = ? ORDER BY timestamp DESC LIMIT 10",
      [email]
    ).map((r) => ({
      hash: r.hash.slice(0, 7),
      authorName: r.author_name,
      authorEmail: r.author_email,
      timestamp: r.timestamp,
      message: r.message,
      commitType: r.commit_type,
    }))
  },

  getPortrait: (email: string) => {
    const db = getDBSync()
    if (!db) return null
    const result = db.getAIResult('member_portrait', email)
    if (!result) return null
    return (JSON.parse(result.result_json) as { portrait: string }).portrait
  },
}))
