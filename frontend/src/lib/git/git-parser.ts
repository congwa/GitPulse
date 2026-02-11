/**
 * Git Log 解析器
 *
 * 将 `git log --pretty=format:...` 输出解析为结构化的 Commit 对象。
 * 使用自定义分隔符避免字段冲突。
 */

/** 自定义字段分隔符（不太可能出现在 commit message 中） */
export const GIT_LOG_SEP = '‡‡‡'
export const GIT_LOG_END = '†††'

/**
 * git log 的 --pretty=format 参数
 * 字段顺序: hash | author_name | author_email | timestamp(unix) | subject
 */
export const GIT_LOG_FORMAT = `--pretty=format:%H${GIT_LOG_SEP}%an${GIT_LOG_SEP}%ae${GIT_LOG_SEP}%at${GIT_LOG_SEP}%s${GIT_LOG_END}`

/** 解析后的单条提交 */
export interface ParsedCommit {
  hash: string
  authorName: string
  authorEmail: string
  /** Unix 秒时间戳 */
  timestamp: number
  message: string
  insertions: number
  deletions: number
  filesChanged: number
  commitType: string
  filePaths: string[]
}

/**
 * 从 commit message 推断提交类型
 */
function inferCommitType(message: string): string {
  const lower = message.toLowerCase()
  // Conventional commits
  if (/^feat[(:!]/.test(lower)) return 'feat'
  if (/^fix[(:!]/.test(lower)) return 'fix'
  if (/^docs[(:!]/.test(lower)) return 'docs'
  if (/^style[(:!]/.test(lower)) return 'style'
  if (/^refactor[(:!]/.test(lower)) return 'refactor'
  if (/^perf[(:!]/.test(lower)) return 'perf'
  if (/^test[(:!]/.test(lower)) return 'test'
  if (/^build[(:!]/.test(lower)) return 'build'
  if (/^ci[(:!]/.test(lower)) return 'ci'
  if (/^chore[(:!]/.test(lower)) return 'chore'
  if (/^revert[(:!]/.test(lower)) return 'revert'
  // Merge commits
  if (/^merge\b/.test(lower)) return 'merge'
  // 中文关键字
  if (lower.includes('修复') || lower.includes('bug')) return 'fix'
  if (lower.includes('新增') || lower.includes('功能') || lower.includes('需求')) return 'feat'
  if (lower.includes('文档')) return 'docs'
  if (lower.includes('重构')) return 'refactor'
  if (lower.includes('测试')) return 'test'
  return 'other'
}

/**
 * 解析 `git log --pretty=format:... --numstat` 的完整输出
 *
 * git 输出格式（注意 numstat 在下一行）：
 * ```
 * hash1‡‡‡name‡‡‡email‡‡‡ts‡‡‡msg†††
 *
 * 10\t5\tsrc/foo.ts
 * 3\t1\tsrc/bar.ts
 * hash2‡‡‡name‡‡‡email‡‡‡ts‡‡‡msg†††
 *
 * 2\t2\tsrc/baz.ts
 * ```
 *
 * 采用逐行扫描策略：遇到包含 GIT_LOG_SEP 的行即为新提交元数据，
 * 后续的 numstat 行归属于当前提交，直到遇到下一个元数据行。
 *
 * **异步版本**：每处理 2000 行 yield 一次，避免阻塞 UI。
 */
export async function parseGitLog(
  raw: string,
  onProgress?: (linesParsed: number, totalLines: number) => void
): Promise<ParsedCommit[]> {
  if (!raw.trim()) return []

  const commits: ParsedCommit[] = []
  const lines = raw.split('\n')
  const totalLines = lines.length

  let currentMeta: string | null = null
  let currentNumstat: string[] = []

  function finalizeCommit() {
    if (!currentMeta) return

    // 去掉末尾的 GIT_LOG_END 标记
    const cleanMeta = currentMeta.replace(GIT_LOG_END, '')
    const parts = cleanMeta.split(GIT_LOG_SEP)
    if (parts.length < 5) return

    const [hash, authorName, authorEmail, tsStr, message] = parts
    if (!hash || hash.trim().length < 7) return

    const timestamp = parseInt(tsStr, 10) * 1000 // 转为毫秒

    let insertions = 0
    let deletions = 0
    const filePaths: string[] = []

    for (const line of currentNumstat) {
      const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/)
      if (match) {
        const ins = match[1] === '-' ? 0 : parseInt(match[1], 10)
        const del = match[2] === '-' ? 0 : parseInt(match[2], 10)
        insertions += ins
        deletions += del
        filePaths.push(match[3])
      }
    }

    commits.push({
      hash: hash.trim(),
      authorName: authorName.trim(),
      authorEmail: authorEmail.trim().toLowerCase(),
      timestamp,
      message: message.trim(),
      insertions,
      deletions,
      filesChanged: filePaths.length,
      commitType: inferCommitType(message.trim()),
      filePaths,
    })
  }

  // 每处理 2000 行 yield 一次，避免阻塞 UI
  const YIELD_INTERVAL = 2000

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 检测元数据行：同时包含字段分隔符和结束标记
    if (line.includes(GIT_LOG_SEP) && line.includes(GIT_LOG_END)) {
      // 先保存上一条提交
      finalizeCommit()
      // 开始新提交
      currentMeta = line
      currentNumstat = []
    } else if (currentMeta) {
      // 否则，如果有当前提交，收集 numstat 行
      const trimmed = line.trim()
      if (trimmed) {
        currentNumstat.push(trimmed)
      }
    }

    // 每 2000 行 yield 一次
    if (i > 0 && i % YIELD_INTERVAL === 0) {
      onProgress?.(i, totalLines)
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  // 别忘了最后一条提交
  finalizeCommit()
  onProgress?.(totalLines, totalLines)

  return commits
}
