/**
 * Git Service
 *
 * 封装 git 操作。
 * - Tauri 环境：通过 Rust 命令执行 git log
 * - 浏览器环境：用户手动粘贴 git log 输出
 */

import { GIT_LOG_FORMAT, GIT_LOG_SEP, GIT_LOG_END, parseGitLog, type ParsedCommit } from './git-parser'

/** 是否运行在 Tauri 环境中 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
}

/**
 * 通过 Tauri invoke 执行 git log
 */
async function tauriGitLog(repoPath: string): Promise<string> {
  const { invoke } = await import(/* @vite-ignore */ '@tauri-apps/api/core')

  const raw = await invoke<string>('run_git_log', {
    path: repoPath,
    format: GIT_LOG_FORMAT,
    extraArgs: ['--no-merges'],
  })

  return raw
}

/**
 * 通过 Tauri 检查路径是否是 Git 仓库
 */
export async function checkGitRepo(repoPath: string): Promise<boolean> {
  if (!isTauri()) return true // 浏览器环境跳过检查

  try {
    const { invoke } = await import(/* @vite-ignore */ '@tauri-apps/api/core')
    return await invoke<boolean>('check_git_repo', { path: repoPath })
  } catch {
    return false
  }
}

/**
 * 获取 Git 提交记录
 *
 * @param repoPath - 仓库路径（Tauri 环境使用）
 * @param rawInput - 手动粘贴的 git log 输出（浏览器环境使用）
 * @returns 解析后的提交数组
 */
export async function fetchGitCommits(
  repoPath: string,
  rawInput?: string,
): Promise<ParsedCommit[]> {
  let raw: string

  if (rawInput) {
    // 手动粘贴的输入
    raw = rawInput
  } else if (isTauri()) {
    // Tauri 环境，通过 Rust 执行 git log
    raw = await tauriGitLog(repoPath)
  } else {
    throw new Error('浏览器环境下请提供 git log 输出')
  }

  console.log(`[GitService] Raw git log: ${raw.length} chars`)

  const commits = await parseGitLog(raw)
  console.log(`[GitService] Parsed ${commits.length} commits`)

  return commits
}

/**
 * 获取用于浏览器环境的 git log 命令提示
 * 用户可以在终端运行此命令然后粘贴输出
 */
export function getGitLogCommand(repoPath?: string): string {
  const cdPart = repoPath ? `cd "${repoPath}" && ` : ''
  return `${cdPart}git log --pretty=format:"%H${GIT_LOG_SEP}%an${GIT_LOG_SEP}%ae${GIT_LOG_SEP}%at${GIT_LOG_SEP}%s${GIT_LOG_END}" --numstat --no-merges`
}

/**
 * 获取仓库最新 commit 的 hash
 *
 * @param repoPath - 仓库路径
 * @returns 最新 commit hash，如果无法获取返回 null
 */
export async function getLatestCommitHash(repoPath: string): Promise<string | null> {
  if (!isTauri()) {
    // 浏览器环境无法获取
    return null
  }

  try {
    const { invoke } = await import(/* @vite-ignore */ '@tauri-apps/api/core')
    const hash = await invoke<string>('get_head_hash', { path: repoPath })
    return hash || null
  } catch (err) {
    console.warn('[GitService] Failed to get HEAD hash:', err)
    return null
  }
}

/**
 * 检查仓库是否有新提交
 *
 * @param repoPath - 仓库路径
 * @param lastKnownHash - 上次分析时记录的最新 commit hash
 * @returns hasNew 表示是否有新提交
 */
export async function hasNewCommits(
  repoPath: string,
  lastKnownHash: string | null,
): Promise<{ hasNew: boolean; currentHash: string | null }> {
  const currentHash = await getLatestCommitHash(repoPath)

  if (!currentHash) {
    // 无法获取当前 hash（浏览器环境或 Git 错误），认为有新提交以触发分析
    return { hasNew: true, currentHash: null }
  }

  if (!lastKnownHash) {
    // 首次分析
    return { hasNew: true, currentHash }
  }

  // 比较 hash
  const hasNew = currentHash !== lastKnownHash
  console.log(`[GitService] hasNewCommits: current=${currentHash.slice(0, 7)}, last=${lastKnownHash.slice(0, 7)}, hasNew=${hasNew}`)

  return { hasNew, currentHash }
}
