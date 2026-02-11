/**
 * GitPulse Agent 封装
 *
 * 基于 langchain v1.2.20 的 createAgent API
 */

import {
  createAgent,
  modelCallLimitMiddleware,
  modelRetryMiddleware,
  toolCallLimitMiddleware,
} from 'langchain'
import { createModel } from './model-factory'
import { allTools } from './tools'
import { SYSTEM_PROMPT } from './prompts'
import type { AIConfig } from '@/stores/settings'

/**
 * 创建标准 GitPulse Agent（流式对话场景）
 */
export function createGitPulseAgent(config: AIConfig) {
  const model = createModel(config)

  return createAgent({
    model,
    tools: allTools,
    systemPrompt: SYSTEM_PROMPT,
    middleware: [
      // modelCallLimit: threadLimit / runLimit
      modelCallLimitMiddleware({
        runLimit: 10,
      }),
      // modelRetry: maxRetries
      modelRetryMiddleware({
        maxRetries: 2,
      }),
      // toolCallLimit: threadLimit / runLimit
      toolCallLimitMiddleware({
        runLimit: 20,
      }),
    ],
  })
}

/**
 * 创建带结构化输出的 Agent（dashboard summary、member tags 等场景）
 *
 * responseFormat 是 createAgent 的一等参数，
 * 结果在 result.structuredResponse 中。
 *
 * 注意：由于 TypeScript 泛型推断限制，每个 task 文件直接调用 createAgent
 * 并传入具体的 Zod schema 来获得正确的类型推断。
 */
export function createStructuredAgentParams(config: AIConfig, systemPrompt?: string) {
  const model = createModel(config)

  return {
    model,
    tools: allTools,
    systemPrompt: systemPrompt || SYSTEM_PROMPT,
    middleware: [
      modelCallLimitMiddleware({ runLimit: 8 }),
      modelRetryMiddleware({ maxRetries: 2 }),
      toolCallLimitMiddleware({ runLimit: 25 }),
    ],
  }
}
