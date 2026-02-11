/**
 * 工贼检测 — 预扫描引擎
 *
 * 从 SQLite 统计数据中快速筛选出需要深度分析的嫌疑目标。
 * 零 LLM 开销，纯本地计算。
 */

import type { GitPulseDB } from '@/lib/database'
import type { ScanResult } from './types'

const TAG = '[PreScan]'

/**
 * 快速预扫描：从 SQLite 中找出嫌疑目标
 */
export function preScanSuspects(db: GitPulseDB): ScanResult {
  const t0 = performance.now()
  console.log(`${TAG} ===== 预扫描开始 =====`)

  // ---- 1. 高频修改文件 ----
  console.log(`${TAG} [1/4] 查询高频修改文件...`)
  const allHotspots = db.query<{
    file_path: string
    total_changes: number
    author_count: number
    primary_owner: string
  }>('SELECT * FROM stats_file_hotspots ORDER BY total_changes DESC')
  console.log(`${TAG} [1/4] 全部热点文件: ${allHotspots.length} 个`)

  // 计算平均修改次数
  const avgChanges = allHotspots.length > 0
    ? allHotspots.reduce((sum, f) => sum + f.total_changes, 0) / allHotspots.length
    : 0
  console.log(`${TAG} [1/4] 平均修改次数: ${avgChanges.toFixed(1)}, 阈值: ${Math.max(avgChanges * 1.5, 5).toFixed(1)}`)

  // 取修改次数超过均值 1.5 倍 且多人参与的文件
  const hotFiles = allHotspots
    .filter((f) => f.total_changes > Math.max(avgChanges * 1.5, 5) && f.author_count >= 2)
    .slice(0, 20)
    .map((f) => ({
      filePath: f.file_path,
      totalChanges: f.total_changes,
      authorCount: f.author_count,
      primaryOwner: f.primary_owner,
    }))
  console.log(`${TAG} [1/4] 嫌疑文件: ${hotFiles.length} 个`)
  hotFiles.forEach((f, i) => console.log(`${TAG}   ${i + 1}. ${f.filePath} (${f.totalChanges}次修改, ${f.authorCount}人)`))

  // ---- 2. 高删除比作者 ----
  console.log(`${TAG} [2/4] 查询高删除比作者...`)
  const allAuthors = db.getAuthorStats()
  console.log(`${TAG} [2/4] 全部作者: ${allAuthors.length} 个`)

  const suspectAuthors = allAuthors
    .filter((a) => {
      const total = a.total_insertions + a.total_deletions
      if (total < 100) return false // 排除贡献过少的
      const deleteRatio = a.total_deletions / Math.max(a.total_insertions, 1)
      return deleteRatio > 0.35 // 删除比 > 35%
    })
    .map((a) => ({
      authorEmail: a.author_email,
      authorName: a.author_name,
      totalInsertions: a.total_insertions,
      totalDeletions: a.total_deletions,
      deleteRatio: a.total_deletions / Math.max(a.total_insertions, 1),
    }))
    .sort((a, b) => b.deleteRatio - a.deleteRatio)
  console.log(`${TAG} [2/4] 嫌疑作者: ${suspectAuthors.length} 个`)
  suspectAuthors.forEach((a, i) => console.log(`${TAG}   ${i + 1}. ${a.authorName} (${a.authorEmail}) 删除比=${(a.deleteRatio * 100).toFixed(1)}%`))

  // ---- 3. 代码接力异常 ----
  console.log(`${TAG} [3/4] 查询代码接力异常...`)
  let hotHandoffs: ScanResult['hotHandoffs'] = []
  try {
    const handoffs = db.query<{
      from_author: string
      to_author: string
      file_path: string
      handoff_count: number
    }>('SELECT * FROM code_handoffs WHERE handoff_count > 3 ORDER BY handoff_count DESC LIMIT 20')

    hotHandoffs = handoffs.map((h) => ({
      fromAuthor: h.from_author,
      toAuthor: h.to_author,
      filePath: h.file_path || '',
      handoffCount: h.handoff_count,
    }))
    console.log(`${TAG} [3/4] 代码接力异常: ${hotHandoffs.length} 对`)
  } catch (err) {
    console.warn(`${TAG} [3/4] 代码接力查询失败 (表可能不存在):`, err)
  }

  // ---- 4. revert 提交 ----
  console.log(`${TAG} [4/4] 查询 revert 提交...`)
  let reverts: ScanResult['reverts'] = []
  try {
    const rawReverts = db.query<{
      hash: string
      author_email: string
      author_name: string
      timestamp: number
      message: string
    }>(
      `SELECT hash, author_email, author_name, timestamp, message
       FROM raw_commits
       WHERE commit_type = 'revert' OR LOWER(message) LIKE '%revert%' OR LOWER(message) LIKE '%撤销%'
       ORDER BY timestamp DESC
       LIMIT 20`
    )
    reverts = rawReverts.map((r) => ({
      hash: r.hash,
      authorEmail: r.author_email,
      authorName: r.author_name,
      timestamp: r.timestamp,
      message: r.message,
    }))
    console.log(`${TAG} [4/4] revert 提交: ${reverts.length} 条`)
  } catch (err) {
    console.warn(`${TAG} [4/4] revert 查询失败:`, err)
  }

  const dt = (performance.now() - t0).toFixed(0)
  console.log(`${TAG} ===== 预扫描完成 (${dt}ms) =====`)
  console.log(`${TAG} 摘要: ${hotFiles.length} 嫌疑文件, ${suspectAuthors.length} 嫌疑作者, ${hotHandoffs.length} 接力异常, ${reverts.length} revert`)

  return {
    hotFiles,
    suspectAuthors,
    hotHandoffs,
    reverts,
  }
}

/**
 * 将预扫描结果格式化为 Agent 可读的提示词
 */
export function formatScanForPrompt(scan: ScanResult): string {
  const parts: string[] = []

  parts.push('## 预扫描结果\n')

  // 热点文件
  if (scan.hotFiles.length > 0) {
    parts.push('### 高频修改文件（嫌疑文件）')
    parts.push('| 文件 | 修改次数 | 参与人数 | 主要维护者 |')
    parts.push('|------|---------|---------|-----------|')
    for (const f of scan.hotFiles) {
      parts.push(`| ${f.filePath} | ${f.totalChanges} | ${f.authorCount} | ${f.primaryOwner} |`)
    }
    parts.push('')
  }

  // 嫌疑作者
  if (scan.suspectAuthors.length > 0) {
    parts.push('### 高删除比成员（嫌疑作者）')
    parts.push('| 成员 | 新增行数 | 删除行数 | 删除比 |')
    parts.push('|------|---------|---------|-------|')
    for (const a of scan.suspectAuthors) {
      parts.push(`| ${a.authorName} (${a.authorEmail}) | ${a.totalInsertions} | ${a.totalDeletions} | ${(a.deleteRatio * 100).toFixed(1)}% |`)
    }
    parts.push('')
  }

  // 代码接力
  if (scan.hotHandoffs.length > 0) {
    parts.push('### 代码接力异常（同文件频繁交替修改）')
    for (const h of scan.hotHandoffs.slice(0, 10)) {
      parts.push(`- ${h.fromAuthor} → ${h.toAuthor}: ${h.filePath || '多文件'} (${h.handoffCount} 次)`)
    }
    parts.push('')
  }

  // Revert 提交
  if (scan.reverts.length > 0) {
    parts.push('### Revert / 撤销提交')
    for (const r of scan.reverts) {
      const date = new Date(r.timestamp).toISOString().split('T')[0]
      parts.push(`- ${date} ${r.authorName}: ${r.message} (${r.hash.slice(0, 7)})`)
    }
    parts.push('')
  }

  if (parts.length <= 1) {
    parts.push('预扫描未发现明显嫌疑目标，请直接从提交统计数据中分析。')
  }

  const prompt = parts.join('\n')
  console.log(`${TAG} 格式化 prompt: ${prompt.length} chars`)
  return prompt
}
