/**
 * Git Ingest — 将解析后的提交数据聚合并写入 SQLite
 *
 * 执行三步：
 * 1. 写入 raw_commits
 * 2. 计算并写入所有聚合统计表
 * 3. 更新 analysis_meta
 *
 * 使用 yield() 在每个阶段之间让出主线程，
 * 保证 React 能够重新渲染进度 UI，不会卡页面。
 */

import type { GitPulseDB } from '@/lib/database'
import type { ParsedCommit } from './git-parser'

export interface IngestProgress {
  stage: 'commits' | 'author_stats' | 'date_stats' | 'heatmap' | 'modules' | 'hotspots' | 'type_trend' | 'collaboration' | 'meta'
  percent: number
  message: string
}

export type ProgressCallback = (p: IngestProgress) => void

/** 让出主线程，让 React 有机会重新渲染 */
function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * 将解析好的提交列表完整入库
 */
export async function ingestCommits(
  db: GitPulseDB,
  commits: ParsedCommit[],
  repoPath: string,
  repoName: string,
  onProgress?: ProgressCallback,
): Promise<{ totalCommits: number; totalAuthors: number; durationMs: number }> {
  const t0 = performance.now()

  if (commits.length === 0) {
    throw new Error('没有找到任何提交记录')
  }

  // —— 1. 写入 raw_commits（分批避免长时间阻塞）——
  onProgress?.({ stage: 'commits', percent: 5, message: `写入 ${commits.length} 条提交记录...` })
  await yieldToUI()

  const BATCH_SIZE = 500
  for (let i = 0; i < commits.length; i += BATCH_SIZE) {
    const batch = commits.slice(i, i + BATCH_SIZE)
    db.insertCommits(batch)
    const batchPercent = 5 + Math.round((i / commits.length) * 10)
    onProgress?.({ stage: 'commits', percent: batchPercent, message: `写入提交记录 ${Math.min(i + BATCH_SIZE, commits.length)}/${commits.length}...` })
    await yieldToUI()
  }

  // —— 2. 按作者聚合 ——
  onProgress?.({ stage: 'author_stats', percent: 15, message: '计算作者统计...' })
  await yieldToUI()
  const authorMap = new Map<string, {
    name: string; commits: number; ins: number; del: number;
    files: Set<string>; firstAt: number; lastAt: number; days: Set<string>;
  }>()

  const YIELD_INTERVAL = 3000 // 每 3000 条提交 yield 一次

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i]
    let a = authorMap.get(c.authorEmail)
    if (!a) {
      a = { name: c.authorName, commits: 0, ins: 0, del: 0, files: new Set(), firstAt: c.timestamp, lastAt: c.timestamp, days: new Set() }
      authorMap.set(c.authorEmail, a)
    }
    a.commits++
    a.ins += c.insertions
    a.del += c.deletions
    c.filePaths.forEach((f) => a!.files.add(f))
    if (c.timestamp < a.firstAt) a.firstAt = c.timestamp
    if (c.timestamp > a.lastAt) a.lastAt = c.timestamp
    a.days.add(new Date(c.timestamp).toISOString().slice(0, 10))

    if (i > 0 && i % YIELD_INTERVAL === 0) await yieldToUI()
  }

  db.upsertAuthorStats(
    Array.from(authorMap.entries()).map(([email, a]) => ({
      authorEmail: email,
      authorName: a.name,
      totalCommits: a.commits,
      totalInsertions: a.ins,
      totalDeletions: a.del,
      filesTouched: a.files.size,
      firstCommitAt: a.firstAt,
      lastCommitAt: a.lastAt,
      activeDays: a.days.size,
      avgCommitSize: a.commits > 0 ? Math.round((a.ins + a.del) / a.commits) : 0,
    }))
  )

  // —— 3. 按日期聚合 ——
  onProgress?.({ stage: 'date_stats', percent: 30, message: '计算日期统计...' })
  await yieldToUI()
  const dateMap = new Map<string, { commits: number; ins: number; del: number; authors: Set<string>; types: Record<string, number> }>()

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i]
    const dateStr = new Date(c.timestamp).toISOString().slice(0, 10)
    let d = dateMap.get(dateStr)
    if (!d) {
      d = { commits: 0, ins: 0, del: 0, authors: new Set(), types: {} }
      dateMap.set(dateStr, d)
    }
    d.commits++
    d.ins += c.insertions
    d.del += c.deletions
    d.authors.add(c.authorEmail)
    d.types[c.commitType] = (d.types[c.commitType] || 0) + 1

    if (i > 0 && i % YIELD_INTERVAL === 0) await yieldToUI()
  }

  db.upsertDateStats(
    Array.from(dateMap.entries()).map(([date, d]) => ({
      date,
      totalCommits: d.commits,
      totalInsertions: d.ins,
      totalDeletions: d.del,
      activeAuthors: d.authors.size,
      commitTypes: d.types,
    }))
  )

  // —— 4. 热力图（全团队 + 每个作者）——
  onProgress?.({ stage: 'heatmap', percent: 45, message: '计算时间热力图...' })
  await yieldToUI()
  // 团队全局
  const teamGrid = new Map<string, number>() // "day-hour" -> count
  // 每个作者
  const authorGrids = new Map<string, Map<string, number>>()

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i]
    const d = new Date(c.timestamp)
    const day = d.getDay() // 0=Sunday
    const hour = d.getHours()
    const key = `${day}-${hour}`

    teamGrid.set(key, (teamGrid.get(key) ?? 0) + 1)

    if (!authorGrids.has(c.authorEmail)) {
      authorGrids.set(c.authorEmail, new Map())
    }
    const ag = authorGrids.get(c.authorEmail)!
    ag.set(key, (ag.get(key) ?? 0) + 1)

    if (i > 0 && i % YIELD_INTERVAL === 0) await yieldToUI()
  }

  const heatmapRows: { authorEmail: string | null; dayOfWeek: number; hourOfDay: number; commitCount: number }[] = []

  for (const [key, count] of teamGrid) {
    const [day, hour] = key.split('-').map(Number)
    heatmapRows.push({ authorEmail: null, dayOfWeek: day, hourOfDay: hour, commitCount: count })
  }

  for (const [email, grid] of authorGrids) {
    for (const [key, count] of grid) {
      const [day, hour] = key.split('-').map(Number)
      heatmapRows.push({ authorEmail: email, dayOfWeek: day, hourOfDay: hour, commitCount: count })
    }
  }

  db.upsertHeatmap(heatmapRows)

  // —— 5. 模块归属 ——
  onProgress?.({ stage: 'modules', percent: 55, message: '计算模块归属...' })
  await yieldToUI()
  const moduleMap = new Map<string, Map<string, { commits: number; ins: number; del: number; lastAt: number }>>()

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i]
    for (const fp of c.filePaths) {
      // 取顶层目录作为模块
      const dir = extractModuleDir(fp)
      if (!moduleMap.has(dir)) moduleMap.set(dir, new Map())
      const authorMods = moduleMap.get(dir)!
      let entry = authorMods.get(c.authorEmail)
      if (!entry) {
        entry = { commits: 0, ins: 0, del: 0, lastAt: 0 }
        authorMods.set(c.authorEmail, entry)
      }
      entry.commits++
      entry.ins += c.insertions > 0 ? Math.ceil(c.insertions / c.filePaths.length) : 0
      entry.del += c.deletions > 0 ? Math.ceil(c.deletions / c.filePaths.length) : 0
      if (c.timestamp > entry.lastAt) entry.lastAt = c.timestamp
    }
    if (i > 0 && i % YIELD_INTERVAL === 0) await yieldToUI()
  }

  const moduleRows: { directory: string; authorEmail: string; commits: number; insertions: number; deletions: number; lastCommitAt: number }[] = []
  for (const [dir, authors] of moduleMap) {
    for (const [email, data] of authors) {
      moduleRows.push({
        directory: dir,
        authorEmail: email,
        commits: data.commits,
        insertions: data.ins,
        deletions: data.del,
        lastCommitAt: data.lastAt,
      })
    }
  }
  db.upsertModuleOwnership(moduleRows)

  // —— 6. 文件热度 ——
  onProgress?.({ stage: 'hotspots', percent: 70, message: '计算文件热度...' })
  await yieldToUI()
  const fileMap = new Map<string, { changes: number; authors: Set<string>; lastAt: number; primaryOwner: string; ownerCount: number }>()

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i]
    for (const fp of c.filePaths) {
      let f = fileMap.get(fp)
      if (!f) {
        f = { changes: 0, authors: new Set(), lastAt: 0, primaryOwner: c.authorEmail, ownerCount: 0 }
        fileMap.set(fp, f)
      }
      f.changes++
      f.authors.add(c.authorEmail)
      if (c.timestamp > f.lastAt) f.lastAt = c.timestamp
    }
    if (i > 0 && i % YIELD_INTERVAL === 0) await yieldToUI()
  }

  // 计算 primaryOwner（修改最多的人）
  const fileAuthorCounts = new Map<string, Map<string, number>>()
  for (let i = 0; i < commits.length; i++) {
    const c = commits[i]
    for (const fp of c.filePaths) {
      if (!fileAuthorCounts.has(fp)) fileAuthorCounts.set(fp, new Map())
      const m = fileAuthorCounts.get(fp)!
      m.set(c.authorEmail, (m.get(c.authorEmail) ?? 0) + 1)
    }
    if (i > 0 && i % YIELD_INTERVAL === 0) await yieldToUI()
  }
  for (const [fp, authors] of fileAuthorCounts) {
    let maxCount = 0
    let owner = ''
    for (const [email, count] of authors) {
      if (count > maxCount) {
        maxCount = count
        owner = email
      }
    }
    const f = fileMap.get(fp)
    if (f) f.primaryOwner = owner
  }

  db.upsertFileHotspots(
    Array.from(fileMap.entries()).map(([fp, f]) => ({
      filePath: fp,
      totalChanges: f.changes,
      authorCount: f.authors.size,
      lastChangeAt: f.lastAt,
      primaryOwner: f.primaryOwner,
    }))
  )

  // —— 7. 提交类型趋势 ——
  onProgress?.({ stage: 'type_trend', percent: 80, message: '计算提交类型趋势...' })
  await yieldToUI()
  const trendMap = new Map<string, number>() // "YYYY-MM|type" -> count

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i]
    const month = new Date(c.timestamp).toISOString().slice(0, 7)
    const key = `${month}|${c.commitType}`
    trendMap.set(key, (trendMap.get(key) ?? 0) + 1)
    if (i > 0 && i % YIELD_INTERVAL === 0) await yieldToUI()
  }

  db.upsertTypeTrend(
    Array.from(trendMap.entries()).map(([key, count]) => {
      const [month, commitType] = key.split('|')
      return { month, commitType, count }
    })
  )

  // —— 8. 协作关系 ——
  onProgress?.({ stage: 'collaboration', percent: 90, message: '计算协作关系...' })
  await yieldToUI()
  // 基于共同修改文件计算
  const fileAuthorsMap = new Map<string, Set<string>>()
  for (let i = 0; i < commits.length; i++) {
    const c = commits[i]
    for (const fp of c.filePaths) {
      if (!fileAuthorsMap.has(fp)) fileAuthorsMap.set(fp, new Set())
      fileAuthorsMap.get(fp)!.add(c.authorEmail)
    }
    if (i > 0 && i % YIELD_INTERVAL === 0) await yieldToUI()
  }

  const pairMap = new Map<string, { sharedFiles: number; modules: Set<string> }>()
  const fileAuthorsEntries = Array.from(fileAuthorsMap.entries())
  for (let i = 0; i < fileAuthorsEntries.length; i++) {
    const [fp, authors] = fileAuthorsEntries[i]
    const arr = Array.from(authors).sort()
    for (let j = 0; j < arr.length; j++) {
      for (let k = j + 1; k < arr.length; k++) {
        const pairKey = `${arr[j]}|||${arr[k]}`
        let p = pairMap.get(pairKey)
        if (!p) {
          p = { sharedFiles: 0, modules: new Set() }
          pairMap.set(pairKey, p)
        }
        p.sharedFiles++
        p.modules.add(extractModuleDir(fp))
      }
    }
    if (i > 0 && i % YIELD_INTERVAL === 0) await yieldToUI()
  }

  const totalFiles = fileAuthorsMap.size || 1
  db.upsertCollabEdges(
    Array.from(pairMap.entries()).map(([key, p]) => {
      const [a, b] = key.split('|||')
      return {
        authorA: a,
        authorB: b,
        sharedFiles: p.sharedFiles,
        strength: Math.round((p.sharedFiles / totalFiles) * 100) / 100,
        mainModules: Array.from(p.modules).slice(0, 5),
      }
    })
  )

  // —— 9. 更新 analysis_meta ——
  onProgress?.({ stage: 'meta', percent: 95, message: '写入分析元数据...' })
  await yieldToUI()
  const durationMs = Math.round(performance.now() - t0)

  // 获取最新 commit 的 hash 用于增量检测
  const latestCommitHash = commits.length > 0 ? commits[0].hash : null

  db.upsertAnalysisMeta({
    repoPath,
    repoName,
    lastAnalyzed: Date.now(),
    totalCommits: commits.length,
    totalAuthors: authorMap.size,
    status: 'git_only', // AI 分析完成后会更新为 completed
    durationMs,
    commitRange: latestCommitHash, // 存储最新 commit hash 用于增量检测
  })

  // 确保持久化
  await db.persist()

  console.log(`[GitIngest] Done: ${commits.length} commits, ${authorMap.size} authors in ${durationMs}ms`)

  return {
    totalCommits: commits.length,
    totalAuthors: authorMap.size,
    durationMs,
  }
}

/**
 * 提取文件路径中的模块目录
 * 例如: src/components/Button.tsx → src/components
 */
function extractModuleDir(filePath: string): string {
  const parts = filePath.split('/')
  if (parts.length <= 1) return '(root)'
  // 取前两级目录
  if (parts.length === 2) return parts[0]
  return parts.slice(0, 2).join('/')
}
