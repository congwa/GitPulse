/**
 * GitPulse 模型工厂
 *
 * 基于 https://models.dev/ 的 provider 列表，支持：
 * - OpenAI 原生 API
 * - Anthropic 原生 API
 * - 所有 OpenAI 兼容端点（DeepSeek、OpenRouter、SiliconFlow、Groq、Together AI 等）
 * - 完全自定义 Base URL + Model
 */

import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { AIConfig } from '@/stores/settings'
import { getProviderConfig } from '@/stores/settings'

export function createModel(config: AIConfig): BaseChatModel {
  const { provider, apiKey, model, baseUrl, temperature } = config

  if (!apiKey) {
    throw new Error('请先在设置中配置 AI API Key')
  }

  const providerConfig = getProviderConfig(provider)
  const finalModel = model || providerConfig.defaultModel

  if (!finalModel) {
    throw new Error('请指定模型名称')
  }

  // Anthropic 原生 SDK
  if (providerConfig.sdkType === 'anthropic') {
    return new ChatAnthropic({
      model: finalModel,
      temperature: temperature ?? 0.3,
      anthropicApiKey: apiKey,
    })
  }

  // OpenAI 原生 或 OpenAI 兼容端点
  const finalBaseUrl = baseUrl || providerConfig.defaultBaseUrl

  return new ChatOpenAI({
    model: finalModel,
    temperature: temperature ?? 0.3,
    apiKey,
    configuration: finalBaseUrl ? { baseURL: finalBaseUrl } : undefined,
  })
}
