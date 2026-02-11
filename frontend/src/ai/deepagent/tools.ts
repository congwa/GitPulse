/**
 * 工贼检测 — DeepAgent 专用工具
 *
 * 基于 TauriBridgeBackend 的文件系统和命令执行工具。
 * 这些工具让 Agent 可以真正读取 Git 仓库源码和执行 Git 命令。
 */

import { tool } from 'langchain'
import { z } from 'zod'
import type { TauriBridgeBackend } from './tauri-bridge-backend'
import { emitActivity } from './activity-channel'

const TAG = '[FsTools]'

/**
 * 创建文件系统工具集（绑定到特定仓库）
 */
export function createFsTools(backend: TauriBridgeBackend) {
  const readFile = tool(
    async ({ filePath, offset, limit }) => {
      console.log(`${TAG} read_file 被调用: path=${filePath}, offset=${offset}, limit=${limit}`)
      const t0 = performance.now()
      try {
        const content = await backend.readFile(filePath, offset ?? undefined, limit ?? undefined)
        const dt = (performance.now() - t0).toFixed(0)
        console.log(`${TAG} read_file 完成 (${dt}ms): ${content.length} chars`)
        if (content.length > 15000) {
          return content.slice(0, 15000) + '\n\n... [truncated, use offset/limit to paginate]'
        }
        return content
      } catch (err) {
        console.error(`${TAG} read_file 失败:`, err)
        return `Error reading file: ${err}`
      }
    },
    {
      name: 'read_file',
      description:
        '读取仓库中的源码文件。支持行级分页（offset/limit）。' +
        '返回文件内容，大文件自动截断（需分页读取）。',
      schema: z.object({
        filePath: z.string().describe('文件相对路径，如 src/app/page.tsx'),
        offset: z.number().optional().describe('起始行号（0-based），用于分页'),
        limit: z.number().optional().describe('读取行数，用于分页'),
      }),
    },
  )

  const ls = tool(
    async ({ path }) => {
      console.log(`${TAG} ls 被调用: path=${path}`)
      try {
        const entries = await backend.ls(path)
        console.log(`${TAG} ls 完成: ${entries.length} 个条目`)
        return JSON.stringify(entries, null, 2)
      } catch (err) {
        console.error(`${TAG} ls 失败:`, err)
        return `Error listing directory: ${err}`
      }
    },
    {
      name: 'ls',
      description: '列出仓库中某个目录的文件和子目录。自动跳过 .git / node_modules 等。',
      schema: z.object({
        path: z.string().describe('目录相对路径，如 src/components 或 . 表示根目录'),
      }),
    },
  )

  const grep = tool(
    async ({ pattern, path, glob }) => {
      console.log(`${TAG} grep 被调用: pattern="${pattern}", path="${path}", glob="${glob}"`)
      try {
        const matches = await backend.grep(pattern, path, glob ?? undefined)
        console.log(`${TAG} grep 完成: ${matches.length} 条匹配`)
        if (matches.length === 0) return 'No matches found.'
        return matches
          .map((m) => `${m.file}:${m.line_number}: ${m.content}`)
          .join('\n')
      } catch (err) {
        console.error(`${TAG} grep 失败:`, err)
        return `Error searching: ${err}`
      }
    },
    {
      name: 'grep',
      description:
        '在仓库中搜索文本（字面匹配）。返回匹配的文件:行号:内容。最多 50 条结果。',
      schema: z.object({
        pattern: z.string().describe('搜索文本（字面匹配，非正则）'),
        path: z.string().optional().describe('搜索范围目录，默认 . 全仓库'),
        glob: z.string().optional().describe('文件模式过滤，如 *.tsx 或 *.ts'),
      }),
    },
  )

  const globTool = tool(
    async ({ pattern, path }) => {
      console.log(`${TAG} glob 被调用: pattern="${pattern}", path="${path}"`)
      try {
        const files = await backend.glob(pattern, path)
        console.log(`${TAG} glob 完成: ${files.length} 个文件`)
        if (files.length === 0) return 'No files found.'
        return files.map((f) => `${f.path} (${f.size} bytes)`).join('\n')
      } catch (err) {
        console.error(`${TAG} glob 失败:`, err)
        return `Error globbing: ${err}`
      }
    },
    {
      name: 'glob',
      description: '按文件名模式搜索仓库文件，如 *.tsx 或 page.tsx。',
      schema: z.object({
        pattern: z.string().describe('文件名 glob 模式，如 *.tsx'),
        path: z.string().optional().describe('搜索范围目录，默认 . 全仓库'),
      }),
    },
  )

  const execute = tool(
    async ({ command }) => {
      console.log(`${TAG} execute 被调用: "${command}"`)
      // 上报活动：截取命令前 80 字符作为摘要
      emitActivity('tool-call', command.length > 80 ? command.slice(0, 77) + '...' : command, command)
      const t0 = performance.now()
      try {
        const result = await backend.execute(command)
        const dt = (performance.now() - t0).toFixed(0)
        let output = ''
        if (result.stdout) {
          output += result.stdout
        }
        if (result.stderr) {
          output += (output ? '\n--- stderr ---\n' : '') + result.stderr
        }
        if (result.exit_code !== 0) {
          output += `\n[exit code: ${result.exit_code}]`
        }
        console.log(`${TAG} execute 完成 (${dt}ms): exit=${result.exit_code}, output=${output.length} chars`)
        // 截断过长输出
        if (output.length > 20000) {
          output = output.slice(0, 20000) + '\n\n... [truncated]'
        }
        return output || '(no output)'
      } catch (err) {
        console.error(`${TAG} execute 失败:`, err)
        return `Error executing command: ${err}`
      }
    },
    {
      name: 'execute',
      description:
        '在仓库目录下执行命令。仅允许安全的只读命令（git, grep, find, cat, head, wc 等）。' +
        '常用：git log, git diff, git show, git blame, rg 搜索。' +
        '禁止写入/删除操作。',
      schema: z.object({
        command: z.string().describe('要执行的命令，如 git log --oneline -20'),
      }),
    },
  )

  return { readFile, ls, grep, glob: globTool, execute }
}

/** 创建工具数组 */
export function createFsToolsArray(backend: TauriBridgeBackend) {
  const tools = createFsTools(backend)
  return [tools.readFile, tools.ls, tools.grep, tools.glob, tools.execute]
}
