/**
 * TauriBridgeBackend
 *
 * 通过 Tauri IPC 桥接 DeepAgent 的文件系统和命令执行需求。
 * 使 Agent 可以在浏览器 WebView 中读取本地 Git 仓库文件和执行 git 命令。
 */

import type {
  ExecuteResponse,
  TauriFileInfo,
  TauriGrepMatch,
} from './types'

const TAG = '[TauriBridge]'

export class TauriBridgeBackend {
  readonly id: string
  private repoPath: string

  constructor(repoPath: string) {
    this.repoPath = repoPath
    this.id = `tauri-bridge-${Date.now()}`
    console.log(`${TAG} 创建 Backend, repoPath=${repoPath}, id=${this.id}`)
  }

  private async invoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
    const t0 = performance.now()
    console.log(`${TAG} IPC 调用: ${cmd}`, args)
    try {
      const { invoke } = await import(/* @vite-ignore */ '@tauri-apps/api/core')
      const result = await invoke<T>(cmd, args)
      const dt = (performance.now() - t0).toFixed(0)
      console.log(`${TAG} IPC 完成: ${cmd} (${dt}ms)`, typeof result === 'string' ? `${result.length} chars` : result)
      return result
    } catch (err) {
      const dt = (performance.now() - t0).toFixed(0)
      console.error(`${TAG} IPC 失败: ${cmd} (${dt}ms)`, err)
      throw err
    }
  }

  /** 执行命令 (git, grep 等) */
  async execute(command: string): Promise<ExecuteResponse> {
    console.log(`${TAG} execute: ${command}`)
    const result = await this.invoke<ExecuteResponse>('deep_execute', {
      repoPath: this.repoPath,
      command,
    })
    console.log(`${TAG} execute 结果: exit=${result.exit_code}, stdout=${result.stdout.length} chars, stderr=${result.stderr.length} chars`)
    return result
  }

  /** 读取文件内容 */
  async readFile(filePath: string, offset?: number, limit?: number): Promise<string> {
    console.log(`${TAG} readFile: ${filePath} (offset=${offset}, limit=${limit})`)
    const result = await this.invoke<string>('deep_read_file', {
      repoPath: this.repoPath,
      filePath,
      offset: offset ?? null,
      limit: limit ?? null,
    })
    console.log(`${TAG} readFile 结果: ${result.length} chars`)
    return result
  }

  /** 列出目录 */
  async ls(path: string = '.'): Promise<TauriFileInfo[]> {
    console.log(`${TAG} ls: ${path}`)
    const result = await this.invoke<TauriFileInfo[]>('deep_ls', {
      repoPath: this.repoPath,
      path,
    })
    console.log(`${TAG} ls 结果: ${result.length} 个条目`)
    return result
  }

  /** 搜索文本 */
  async grep(pattern: string, path: string = '.', glob?: string): Promise<TauriGrepMatch[]> {
    console.log(`${TAG} grep: pattern="${pattern}", path="${path}", glob="${glob}"`)
    const result = await this.invoke<TauriGrepMatch[]>('deep_grep', {
      repoPath: this.repoPath,
      pattern,
      path,
      glob: glob ?? null,
    })
    console.log(`${TAG} grep 结果: ${result.length} 条匹配`)
    return result
  }

  /** glob 文件搜索 */
  async glob(pattern: string, path: string = '.'): Promise<TauriFileInfo[]> {
    console.log(`${TAG} glob: pattern="${pattern}", path="${path}"`)
    const result = await this.invoke<TauriFileInfo[]>('deep_glob', {
      repoPath: this.repoPath,
      pattern,
      path,
    })
    console.log(`${TAG} glob 结果: ${result.length} 个文件`)
    return result
  }
}
