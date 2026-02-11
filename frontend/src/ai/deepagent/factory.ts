/**
 * 工贼检测 — DeepAgent 工厂
 *
 * 基于 langchain createAgent 实现 DeepAgent 的多级 Agent 架构：
 * - Orchestrator: 主控 Agent，调度 SubAgents
 * - SubAgents: code-archaeologist / git-forensics / pattern-detective
 * - task 工具: 派遣 SubAgent 执行子任务
 *
 * 使用 langchain createAgent（而非 deepagents npm 包），
 * 因为 deepagents 的 config.ts/skills/loader.ts 依赖 Node.js 的 fs 模块，
 * 无法在 Tauri WebView (浏览器) 环境中运行。
 * 我们在此手动实现 DeepAgent 的核心模式：SubAgent 调度 + Skills 注入。
 */

import {
  createAgent,
  tool,
  modelCallLimitMiddleware,
  modelRetryMiddleware,
  toolCallLimitMiddleware,
} from 'langchain'
import { z } from 'zod'
import { createModel } from '../model-factory'
import { allTools as sqliteTools } from '../tools'
import { TauriBridgeBackend } from './tauri-bridge-backend'
import { createFsToolsArray } from './tools'
import {
  ORCHESTRATOR_PROMPT,
  CODE_ARCHAEOLOGIST_PROMPT,
  GIT_FORENSICS_PROMPT,
  PATTERN_DETECTIVE_PROMPT,
} from './prompts'
import { WASTE_SKILL_CONTENT } from './skill-content'
import { emitActivity } from './activity-channel'
import type { AIConfig } from '@/stores/settings'

const TAG = '[WasteFactory]'

/** SubAgent 定义 */
interface SubAgentDef {
  name: string
  description: string
  systemPrompt: string
  /** 额外工具（除了 fs 工具） */
  extraTools?: ReturnType<typeof sqliteTools.map>
}

/** 全局计数器，追踪 task 调用次数 */
let taskCallCounter = 0

/**
 * 创建 task 工具 — 实现 SubAgent 调度
 *
 * 当 Orchestrator 调用 task(subagentName, instruction) 时：
 * 1. 根据 name 找到对应的 SubAgent 定义
 * 2. 创建一个独立的 Agent（独立上下文窗口）
 * 3. 执行 instruction
 * 4. 返回 SubAgent 的最终回复
 */
function createTaskTool(
  config: AIConfig,
  backend: TauriBridgeBackend,
  subagents: SubAgentDef[],
) {
  const fsTools = createFsToolsArray(backend)
  const model = createModel(config)

  return tool(
    async ({ subagentName, instruction }) => {
      const callId = ++taskCallCounter
      const t0 = performance.now()

      console.log(`${TAG} ===== task #${callId} 开始 =====`)
      console.log(`${TAG} task #${callId} SubAgent: ${subagentName}`)
      console.log(`${TAG} task #${callId} 指令 (${instruction.length} chars): ${instruction.slice(0, 200)}...`)

      // 上报活动：SubAgent 派遣
      emitActivity(
        'task-start',
        `派遣 ${subagentName}`,
        instruction.slice(0, 120),
      )

      const def = subagents.find((s) => s.name === subagentName)
      if (!def) {
        console.error(`${TAG} task #${callId} 未知 SubAgent: "${subagentName}"`)
        return `Error: Unknown subagent "${subagentName}". Available: ${subagents.map(s => s.name).join(', ')}`
      }

      // 将 Skill 内容注入到 SubAgent 的 system prompt
      const fullPrompt = `${def.systemPrompt}\n\n## Waste Detection Skill\n\n${WASTE_SKILL_CONTENT}`

      console.log(`${TAG} task #${callId} 创建 SubAgent "${subagentName}", tools: [fs x${fsTools.length}, extra x${def.extraTools?.length ?? 0}]`)

      // 创建独立的 SubAgent
      // middleware limits 和 recursionLimit 的关系：
      //   每个 ReAct cycle = 2 recursion steps (agent node + tools node)
      //   recursionLimit 需要 >= 2 * modelCallLimit + buffer（用于 retries 和 routing）
      // SubAgent 限制：
      // - modelCallLimit=12: 足够 8-10 次 tool 调用 + 1-2 次生成结论
      //   （之前 20 太多，模型会浪费在重复的 awk 命令上）
      // - toolCallLimit=25: 略高于 modelCallLimit 以容纳 retry
      // - 即使达到限制，factory 会从中间消息中恢复已收集的数据
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subAgent = createAgent({
        model,
        tools: [...fsTools, ...(def.extraTools || [])] as any,
        systemPrompt: fullPrompt,
        middleware: [
          modelCallLimitMiddleware({ runLimit: 12 }),
          modelRetryMiddleware({ maxRetries: 2 }),
          toolCallLimitMiddleware({ runLimit: 25 }),
        ],
      } as any)

      try {
        // 执行 SubAgent（独立的 recursionLimit）
        // recursionLimit = 2 * modelCallLimit * (1 + maxRetries) + buffer = 2 * 12 * 3 + 30 = 102 → 取 120
        console.log(`${TAG} task #${callId} 开始执行 SubAgent (recursionLimit=120)...`)

        // 超时保护：单个 SubAgent 最多运行 90 秒
        const SUBAGENT_TIMEOUT_MS = 90_000
        const invokePromise = subAgent.invoke(
          {
            messages: [{ role: 'user', content: instruction }],
          },
          {
            recursionLimit: 120,
          },
        )
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`SubAgent timeout after ${SUBAGENT_TIMEOUT_MS / 1000}s`)), SUBAGENT_TIMEOUT_MS),
        )
        const result = await Promise.race([invokePromise, timeoutPromise])

        const dt = (performance.now() - t0).toFixed(0)
        const msgCount = result.messages?.length ?? 0
        console.log(`${TAG} task #${callId} SubAgent 完成 (${dt}ms), ${msgCount} 条消息`)

        // 上报活动：SubAgent 完成
        emitActivity(
          'task-complete',
          `${subagentName} 完成 (${(Number(dt) / 1000).toFixed(1)}s)`,
          `${msgCount} 条消息`,
        )

        // 打印 SubAgent 消息摘要
        if (result.messages && Array.isArray(result.messages)) {
          result.messages.forEach((msg: unknown, idx: number) => {
            const m = msg as { _getType?: () => string; content?: string | unknown[]; tool_calls?: unknown[]; name?: string }
            const type = m._getType?.() ?? 'unknown'
            const contentLen = typeof m.content === 'string' ? m.content.length : 0
            const toolCalls = m.tool_calls?.length ?? 0
            const name = m.name ?? ''
            console.log(`${TAG} task #${callId}   msg[${idx}] type=${type} toolCalls=${toolCalls} name=${name} contentLen=${contentLen}`)
          })
        }

        // 提取最终回复
        const lastMsg = result.messages?.[result.messages.length - 1]
        if (lastMsg && typeof lastMsg.content === 'string') {
          console.log(`${TAG} task #${callId} 返回内容: ${lastMsg.content.length} chars`)
          console.log(`${TAG} task #${callId} 返回预览: ${lastMsg.content.slice(0, 200)}...`)

          // ---- 关键修复：SubAgent 达到模型调用限制时，提取已收集的中间数据 ----
          // SubAgent 可能已通过 tool 收集了大量有价值的 git 数据，
          // 但在生成结论前被限制中断。此时不应只返回错误消息，
          // 而应将已收集的 tool 结果汇总返回给 Orchestrator
          if (lastMsg.content.includes('Model call limits')) {
            console.warn(`${TAG} task #${callId} 模型调用限制触发，从中间消息提取已收集数据...`)
            const collectedData: string[] = []
            if (result.messages && Array.isArray(result.messages)) {
              for (const msg of result.messages) {
                const m = msg as { _getType?: () => string; content?: string | unknown[]; name?: string }
                const type = m._getType?.() ?? 'unknown'
                const content = typeof m.content === 'string' ? m.content : ''
                // 收集 tool 返回的有效数据（git log 输出、查询结果等）
                if (type === 'tool' && content.length > 30) {
                  collectedData.push(content.slice(0, 3000))
                }
                // 收集 AI 的中间分析文本（非 tool call、非错误消息）
                else if (type === 'ai' && content.length > 30 && !content.includes('Model call limits')) {
                  collectedData.push(`[AI 分析]: ${content.slice(0, 500)}`)
                }
              }
            }
            if (collectedData.length > 0) {
              const combined = collectedData.join('\n---\n').slice(0, 15000)
              const recoveredResult = `[${subagentName}] 达到模型调用限制，但已收集 ${collectedData.length} 条原始数据。请基于以下数据直接分析：\n\n${combined}`
              console.log(`${TAG} task #${callId} 恢复数据: ${recoveredResult.length} chars (${collectedData.length} 条)`)
              emitActivity('task-complete', `${subagentName} 达到限制但已恢复数据`, `${collectedData.length} 条原始数据`)
              return recoveredResult
            }
            console.warn(`${TAG} task #${callId} 无法恢复数据，返回降级提示`)
            return `SubAgent "${subagentName}" 达到模型调用限制且无可用数据。请基于预扫描结果直接生成报告。`
          }

          return lastMsg.content
        }
        // 如果有 structuredResponse
        if (result.structuredResponse) {
          const json = JSON.stringify(result.structuredResponse, null, 2)
          console.log(`${TAG} task #${callId} 返回 structuredResponse: ${json.length} chars`)
          return json
        }
        const fallback = JSON.stringify(result, null, 2)
        console.warn(`${TAG} task #${callId} 无法提取内容，返回整个 result: ${fallback.length} chars`)
        return fallback
      } catch (err) {
        const dt = (performance.now() - t0).toFixed(0)
        const errMsg = err instanceof Error ? err.message : String(err)
        const isLimitError = errMsg.includes('Recursion limit') || errMsg.includes('Model call limits') || errMsg.includes('timeout')
        console.error(`${TAG} task #${callId} SubAgent "${subagentName}" 失败 (${dt}ms):`, err)

        if (isLimitError) {
          // 优雅降级：返回错误说明而非让 Orchestrator 重试同样的任务
          console.warn(`${TAG} task #${callId} 限制触发，返回降级提示给 Orchestrator`)
          emitActivity('task-error', `${subagentName} 达到执行限制`, errMsg)
          return `SubAgent "${subagentName}" 因达到执行限制而中止 (${errMsg})。请不要重试相同任务，而是基于已有信息直接生成报告。`
        }
        emitActivity('task-error', `${subagentName} 执行失败`, errMsg)
        return `SubAgent "${subagentName}" error: ${errMsg}`
      }
    },
    {
      name: 'task',
      description:
        '派遣专业 SubAgent 执行子任务。每个 SubAgent 有独立的上下文窗口。' +
        '可用的 SubAgent：\n' +
        subagents.map((s) => `- ${s.name}: ${s.description}`).join('\n'),
      schema: z.object({
        subagentName: z.string().describe(
          `SubAgent 名称: ${subagents.map(s => s.name).join(' | ')}`
        ),
        instruction: z.string().describe(
          '给 SubAgent 的详细指令。包含文件路径、commit hash 等具体信息。'
        ),
      }),
    },
  )
}

/**
 * 创建工贼检测 DeepAgent
 *
 * 架构:
 * Orchestrator (主控)
 *   ├── task("code-archaeologist", ...) → 读源码理解业务
 *   ├── task("git-forensics", ...)      → git 命令追踪历史
 *   └── task("pattern-detective", ...)  → 综合判定无用功
 */
export function createWasteDetectionAgent(config: AIConfig, repoPath: string) {
  console.log(`${TAG} ===== 创建 Orchestrator Agent =====`)
  console.log(`${TAG} repoPath: ${repoPath}`)
  console.log(`${TAG} model: ${config.model}, provider: ${config.provider}`)

  taskCallCounter = 0 // 重置计数器

  const backend = new TauriBridgeBackend(repoPath)
  const model = createModel(config)
  const fsTools = createFsToolsArray(backend)

  console.log(`${TAG} fsTools: ${fsTools.length} 个, sqliteTools: ${sqliteTools.length} 个`)

  // SubAgent 定义
  const subagents: SubAgentDef[] = [
    {
      name: 'code-archaeologist',
      description:
        '代码考古师：阅读源码，理解业务功能和代码质量。当需要理解某个文件/模块是做什么的、被删代码是否有价值时，派遣此 Agent。',
      systemPrompt: CODE_ARCHAEOLOGIST_PROMPT,
    },
    {
      name: 'git-forensics',
      description:
        'Git 取证官：执行 git 命令获取变更历史。当需要追踪文件修改历史(git log)、具体 diff(git show)、代码归属(git blame)时，派遣此 Agent。',
      systemPrompt: GIT_FORENSICS_PROMPT,
      extraTools: [...sqliteTools],
    },
    {
      name: 'pattern-detective',
      description:
        '模式侦探：综合代码和历史，判定无用功模式(W1~W7)。当已有代码理解和变更历史后，需要做最终判定时，派遣此 Agent。',
      systemPrompt: PATTERN_DETECTIVE_PROMPT,
      extraTools: [...sqliteTools],
    },
  ]

  console.log(`${TAG} SubAgents: ${subagents.map(s => s.name).join(', ')}`)

  // 创建 task 工具
  const taskTool = createTaskTool(config, backend, subagents)

  // 将 Skill 内容注入到 Orchestrator prompt
  const fullOrchestratorPrompt = `${ORCHESTRATOR_PROMPT}\n\n## Waste Detection Skill Reference\n\n${WASTE_SKILL_CONTENT}`
  console.log(`${TAG} Orchestrator prompt: ${fullOrchestratorPrompt.length} chars`)

  // 创建 Orchestrator Agent
  // Orchestrator 只通过 task 工具调度 SubAgent + SQLite 查询
  // 不给 fsTools 以免 Orchestrator 绕过 SubAgent 直接执行 git 命令，浪费 model call budget
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agent = createAgent({
    model,
    tools: [...sqliteTools, taskTool],
    systemPrompt: fullOrchestratorPrompt,
    middleware: [
      modelCallLimitMiddleware({ runLimit: 15 }),
      modelRetryMiddleware({ maxRetries: 2 }),
      toolCallLimitMiddleware({ runLimit: 30 }),
    ],
  } as any)

  console.log(`${TAG} Orchestrator Agent 创建完成 (modelCallLimit=15, toolCallLimit=30, NO fsTools)`)
  return agent
}
