import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * AI 服务商列表
 * 基于 https://models.dev/ 的主流 provider
 * 所有非 Anthropic 原生 API 的都走 OpenAI 兼容接口
 */
export const AI_PROVIDERS = [
  { id: 'openai', label: 'OpenAI', defaultBaseUrl: '', defaultModel: 'gpt-4o', sdkType: 'openai' as const },
  { id: 'anthropic', label: 'Anthropic', defaultBaseUrl: '', defaultModel: 'claude-sonnet-4-5-20250929', sdkType: 'anthropic' as const },
  { id: 'deepseek', label: 'DeepSeek', defaultBaseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat', sdkType: 'openai' as const },
  { id: 'openrouter', label: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o', sdkType: 'openai' as const },
  { id: 'siliconflow', label: 'SiliconFlow', defaultBaseUrl: 'https://api.siliconflow.cn/v1', defaultModel: 'deepseek-ai/DeepSeek-V3', sdkType: 'openai' as const },
  { id: 'groq', label: 'Groq', defaultBaseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', sdkType: 'openai' as const },
  { id: 'together', label: 'Together AI', defaultBaseUrl: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', sdkType: 'openai' as const },
  { id: 'fireworks', label: 'Fireworks AI', defaultBaseUrl: 'https://api.fireworks.ai/inference/v1', defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct', sdkType: 'openai' as const },
  { id: 'custom', label: '自定义 (OpenAI 兼容)', defaultBaseUrl: '', defaultModel: '', sdkType: 'openai' as const },
] as const

export type ProviderId = typeof AI_PROVIDERS[number]['id']

export interface AIConfig {
  provider: ProviderId
  apiKey: string
  model: string
  baseUrl: string
  temperature: number
}

export interface AnalysisConfig {
  timeRange: '30d' | '90d' | '180d' | '365d' | 'all'
  ignoreFileTypes: string[]
  ignoreDirs: string[]
  ignoreAuthors: string[]
  excludeMergeCommits: boolean
}

export interface AppearanceConfig {
  theme: 'light' | 'dark' | 'system'
  language: 'zh' | 'en'
  chartColorScheme: 'default' | 'warm' | 'mono' | 'rainbow'
}

interface SettingsState {
  aiConfig: AIConfig
  /** AI 连接是否已验证通过 */
  aiVerified: boolean
  analysisConfig: AnalysisConfig
  appearance: AppearanceConfig

  setAIConfig: (c: Partial<AIConfig>) => void
  setAIVerified: (v: boolean) => void
  setAnalysisConfig: (c: Partial<AnalysisConfig>) => void
  setAppearance: (c: Partial<AppearanceConfig>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      aiConfig: {
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4o',
        baseUrl: '',
        temperature: 0.3,
      },
      aiVerified: false,
      analysisConfig: {
        timeRange: '90d',
        ignoreFileTypes: ['.lock', '.min.js', '.min.css'],
        ignoreDirs: ['node_modules', 'dist', '.git', 'vendor'],
        ignoreAuthors: ['dependabot[bot]', 'renovate[bot]'],
        excludeMergeCommits: true,
      },
      appearance: {
        theme: 'system',
        language: 'zh',
        chartColorScheme: 'default',
      },

      setAIConfig: (c) =>
        set((s) => ({
          aiConfig: { ...s.aiConfig, ...c },
          // 修改配置后重置验证状态
          aiVerified: false,
        })),
      setAIVerified: (v) => set({ aiVerified: v }),
      setAnalysisConfig: (c) => set((s) => ({ analysisConfig: { ...s.analysisConfig, ...c } })),
      setAppearance: (c) => set((s) => ({ appearance: { ...s.appearance, ...c } })),
    }),
    {
      name: 'gitpulse-settings',
      version: 2,
      migrate: () => ({
        // v2: 重置所有配置，适配新的 AI_PROVIDERS 结构
        aiConfig: {
          provider: 'openai' as ProviderId,
          apiKey: '',
          model: 'gpt-4o',
          baseUrl: '',
          temperature: 0.3,
        },
        aiVerified: false,
        analysisConfig: {
          timeRange: '90d' as const,
          ignoreFileTypes: ['.lock', '.min.js', '.min.css'],
          ignoreDirs: ['node_modules', 'dist', '.git', 'vendor'],
          ignoreAuthors: ['dependabot[bot]', 'renovate[bot]'],
          excludeMergeCommits: true,
        },
        appearance: {
          theme: 'system' as const,
          language: 'zh' as const,
          chartColorScheme: 'default' as const,
        },
      }),
    }
  )
)

/** 工具函数：根据 provider ID 获取 provider 配置 */
export function getProviderConfig(id: ProviderId) {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[AI_PROVIDERS.length - 1]
}
