import { useState, useCallback } from 'react'
import {
  Settings,
  Bot,
  SlidersHorizontal,
  Palette,
  Database,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Monitor,
  X,
  Check,
  ExternalLink,
  Loader2,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDBStore } from '@/stores/db-store'
import { fullReset } from '@/lib/database'
import { useSettingsStore, AI_PROVIDERS, getProviderConfig } from '@/stores/settings'
import type { ProviderId } from '@/stores/settings'
import { useTheme } from '@/components/theme-provider'
import { PageHeader } from '@/components/ui/page-header'
import { Tag } from '@/components/ui/tag'

/* ─── shared form helpers ─── */

function SectionCard({
  icon,
  title,
  badge,
  children,
}: {
  icon: React.ReactNode
  title: string
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface rounded-[20px] border border-border p-6 mb-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
          {icon}
        </div>
        <h2 className="font-heading text-base font-semibold text-text">{title}</h2>
        {badge}
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  )
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label className="block text-sm font-semibold text-text">{children}</label>
      {hint && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
    </div>
  )
}

const selectClass = cn(
  'w-full appearance-none rounded-[12px] border border-border bg-background',
  'px-3.5 py-2.5 text-sm text-text outline-none',
  'focus:border-border-focus focus:ring-2 focus:ring-primary/20',
  'transition-colors cursor-pointer hover:bg-surface-hover'
)

const inputClass = cn(
  'w-full rounded-[12px] border border-border bg-background',
  'px-3.5 py-2.5 text-sm text-text outline-none',
  'focus:border-border-focus focus:ring-2 focus:ring-primary/20',
  'placeholder:text-text-muted'
)

/** 每个 Provider 推荐的模型列表 */
const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'],
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101', 'claude-haiku-4-5-20251001'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  openrouter: ['openai/gpt-4o', 'anthropic/claude-sonnet-4.5', 'deepseek/deepseek-v3.2', 'google/gemini-2.5-flash'],
  siliconflow: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen3-235B-A22B'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen-qwq-32b'],
  together: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'deepseek-ai/DeepSeek-V3'],
  fireworks: ['accounts/fireworks/models/deepseek-v3p2', 'accounts/fireworks/models/llama-v3p3-70b-instruct'],
  custom: [],
}

/* ─── page ─── */

export default function SettingsPage() {
  const {
    aiConfig,
    aiVerified,
    setAIConfig,
    setAIVerified,
    analysisConfig,
    setAnalysisConfig,
    appearance,
    setAppearance,
  } = useSettingsStore()
  const dbSize = useDBStore((s) => s.dbSize)
  const { setTheme } = useTheme()

  const [showKey, setShowKey] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [connectionError, setConnectionError] = useState('')
  const [customModelInput, setCustomModelInput] = useState('')

  const currentProvider = getProviderConfig(aiConfig.provider)
  const needsBaseUrl = currentProvider.id === 'custom'
  const availableModels = PROVIDER_MODELS[aiConfig.provider] || []

  function handleThemeChange(t: 'light' | 'dark' | 'system') {
    setAppearance({ theme: t })
    setTheme(t)
  }

  function handleProviderChange(providerId: ProviderId) {
    const config = getProviderConfig(providerId)
    setAIConfig({
      provider: providerId,
      model: config.defaultModel,
      baseUrl: config.defaultBaseUrl,
    })
  }

  const handleTestConnection = useCallback(async () => {
    if (!aiConfig.apiKey) {
      setConnectionStatus('error')
      setConnectionError('请先填写 API Key')
      setTimeout(() => setConnectionStatus('idle'), 3000)
      return
    }

    if (!aiConfig.model) {
      setConnectionStatus('error')
      setConnectionError('请先选择或输入模型名称')
      setTimeout(() => setConnectionStatus('idle'), 3000)
      return
    }

    setConnectionStatus('testing')
    setConnectionError('')

    try {
      const { createModel } = await import('@/ai/model-factory')
      const model = createModel(aiConfig)
      await model.invoke([{ role: 'user', content: 'hi' }])
      setConnectionStatus('success')
      setAIVerified(true)
      setTimeout(() => setConnectionStatus('idle'), 3000)
    } catch (err) {
      setConnectionStatus('error')
      setAIVerified(false)
      try {
        const { handleAIError } = await import('@/ai/error-handler')
        setConnectionError(handleAIError(err).message)
      } catch {
        setConnectionError(err instanceof Error ? err.message : String(err))
      }
      setTimeout(() => setConnectionStatus('idle'), 5000)
    }
  }, [aiConfig, setAIVerified])

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Settings className="h-5 w-5" strokeWidth={1.75} />}
        title="设置"
      />

      <div className="mx-auto max-w-2xl">
        {/* ── AI 配置 ── */}
        <SectionCard
          icon={<Bot className="h-4.5 w-4.5" strokeWidth={1.75} />}
          title="AI 配置"
          badge={
            aiVerified ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-accent bg-accent-soft px-2 py-0.5 rounded-full">
                <ShieldCheck className="h-3 w-3" />
                已验证
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                <ShieldAlert className="h-3 w-3" />
                未验证
              </span>
            )
          }
        >
          {/* Provider */}
          <div>
            <FieldLabel hint="选择 AI 服务商，支持所有 OpenAI 兼容接口">服务商</FieldLabel>
            <select
              value={aiConfig.provider}
              onChange={(e) => handleProviderChange(e.target.value as ProviderId)}
              aria-label="AI 服务商"
              className={selectClass}
            >
              {AI_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <div className="mt-1.5 flex items-center gap-1">
              <a
                href="https://models.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                在 models.dev 查看所有可用模型和价格
              </a>
            </div>
          </div>

          {/* API Key */}
          <div>
            <FieldLabel>API Key</FieldLabel>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={aiConfig.apiKey}
                onChange={(e) => setAIConfig({ apiKey: e.target.value })}
                placeholder="sk-..."
                className={cn(inputClass, 'pr-11')}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary cursor-pointer"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>

          {/* Base URL */}
          <div>
            <FieldLabel hint={needsBaseUrl ? '必填：自定义服务商的 API 端点地址' : '可选：留空使用默认地址，也可自定义覆盖'}>
              Base URL
            </FieldLabel>
            <input
              type="text"
              value={aiConfig.baseUrl}
              onChange={(e) => setAIConfig({ baseUrl: e.target.value })}
              placeholder={currentProvider.defaultBaseUrl || 'https://api.example.com/v1'}
              className={inputClass}
            />
            {currentProvider.defaultBaseUrl && !aiConfig.baseUrl && (
              <p className="text-xs text-text-muted mt-1">
                默认: {currentProvider.defaultBaseUrl}
              </p>
            )}
          </div>

          {/* Model */}
          <div>
            <FieldLabel hint="选择预设模型或输入自定义模型名称">模型</FieldLabel>
            {availableModels.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={availableModels.includes(aiConfig.model) ? aiConfig.model : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCustomModelInput(aiConfig.model)
                    } else {
                      setAIConfig({ model: e.target.value })
                    }
                  }}
                  aria-label="模型选择"
                  className={selectClass}
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="__custom__">✏️ 自定义模型名称...</option>
                </select>
                {(!availableModels.includes(aiConfig.model)) && (
                  <input
                    type="text"
                    value={aiConfig.model || customModelInput}
                    onChange={(e) => {
                      setCustomModelInput(e.target.value)
                      setAIConfig({ model: e.target.value })
                    }}
                    placeholder="输入模型名称，如 gpt-4o-2024-11-20"
                    className={inputClass}
                  />
                )}
              </div>
            ) : (
              <input
                type="text"
                value={aiConfig.model}
                onChange={(e) => setAIConfig({ model: e.target.value })}
                placeholder="输入模型名称"
                className={inputClass}
              />
            )}
          </div>

          {/* Temperature */}
          <div>
            <FieldLabel>Temperature: {aiConfig.temperature.toFixed(2)}</FieldLabel>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={aiConfig.temperature}
              onChange={(e) => setAIConfig({ temperature: parseFloat(e.target.value) })}
              aria-label="Temperature"
              className="w-full accent-primary cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-xs text-text-muted">
              <span>精确 0</span>
              <span>创意 1</span>
            </div>
          </div>

          {/* Test connection */}
          <div className="border-t border-border pt-5">
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestConnection}
                disabled={connectionStatus === 'testing'}
                className={cn(
                  'inline-flex items-center gap-2 rounded-[12px] px-5 py-2.5 text-sm font-semibold',
                  'cursor-pointer transition-colors',
                  connectionStatus === 'success'
                    ? 'bg-accent-soft text-accent'
                    : connectionStatus === 'error'
                      ? 'bg-danger/10 text-danger'
                      : 'bg-primary text-primary-foreground hover:opacity-90',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {connectionStatus === 'success' ? (
                  <>
                    <Check className="h-4 w-4" strokeWidth={1.75} />
                    连接成功
                  </>
                ) : connectionStatus === 'error' ? (
                  <>
                    <X className="h-4 w-4" strokeWidth={1.75} />
                    连接失败
                  </>
                ) : connectionStatus === 'testing' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                    测试中...
                  </>
                ) : (
                  '测试连接'
                )}
              </button>

              {!aiVerified && connectionStatus === 'idle' && (
                <span className="text-xs text-warning">请测试连接以验证配置</span>
              )}
            </div>
            {connectionError && connectionStatus === 'error' && (
              <p className="mt-2 text-xs text-danger bg-danger/5 rounded-lg px-3 py-2">{connectionError}</p>
            )}
          </div>
        </SectionCard>

        {/* ── 分析配置 ── */}
        <SectionCard
          icon={<SlidersHorizontal className="h-4.5 w-4.5" strokeWidth={1.75} />}
          title="分析配置"
        >
          {/* Time range */}
          <div>
            <FieldLabel>时间范围</FieldLabel>
            <select
              value={analysisConfig.timeRange}
              onChange={(e) => setAnalysisConfig({ timeRange: e.target.value as typeof analysisConfig.timeRange })}
              aria-label="时间范围"
              className={selectClass}
            >
              <option value="30d">近 30 天</option>
              <option value="90d">近 90 天</option>
              <option value="180d">近 180 天</option>
              <option value="365d">近 1 年</option>
              <option value="all">全部</option>
            </select>
          </div>

          {/* Ignore file types */}
          <div>
            <FieldLabel>忽略文件类型</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {analysisConfig.ignoreFileTypes.map((ft) => (
                <Tag key={ft} variant="muted" className="gap-1">
                  {ft}
                  <button
                    onClick={() =>
                      setAnalysisConfig({
                        ignoreFileTypes: analysisConfig.ignoreFileTypes.filter((x) => x !== ft),
                      })
                    }
                    aria-label={`移除 ${ft}`}
                    className="ml-0.5 cursor-pointer hover:text-danger"
                  >
                    <X className="h-3 w-3" strokeWidth={2} />
                  </button>
                </Tag>
              ))}
            </div>
          </div>

          {/* Ignore dirs */}
          <div>
            <FieldLabel>忽略目录</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {analysisConfig.ignoreDirs.map((d) => (
                <Tag key={d} variant="muted" className="gap-1">
                  {d}
                  <button
                    onClick={() =>
                      setAnalysisConfig({
                        ignoreDirs: analysisConfig.ignoreDirs.filter((x) => x !== d),
                      })
                    }
                    aria-label={`移除 ${d}`}
                    className="ml-0.5 cursor-pointer hover:text-danger"
                  >
                    <X className="h-3 w-3" strokeWidth={2} />
                  </button>
                </Tag>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* ── 外观设置 ── */}
        <SectionCard
          icon={<Palette className="h-4.5 w-4.5" strokeWidth={1.75} />}
          title="外观设置"
        >
          {/* Theme switcher */}
          <div>
            <FieldLabel>主题</FieldLabel>
            <div className="inline-flex rounded-[12px] border border-border overflow-hidden">
              {(
                [
                  { value: 'light', label: '亮色', icon: <Sun className="h-4 w-4" strokeWidth={1.75} /> },
                  { value: 'dark', label: '暗色', icon: <Moon className="h-4 w-4" strokeWidth={1.75} /> },
                  { value: 'system', label: '系统', icon: <Monitor className="h-4 w-4" strokeWidth={1.75} /> },
                ] as const
              ).map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleThemeChange(t.value)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold cursor-pointer transition-colors',
                    appearance.theme === t.value
                      ? 'bg-primary-soft text-primary'
                      : 'bg-surface text-text-secondary hover:bg-surface-hover'
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <FieldLabel>语言</FieldLabel>
            <select
              value={appearance.language}
              onChange={(e) => setAppearance({ language: e.target.value as 'zh' | 'en' })}
              aria-label="语言选择"
              className={selectClass}
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </SectionCard>

        {/* ── 数据管理 ── */}
        <SectionCard
          icon={<Database className="h-4.5 w-4.5" strokeWidth={1.75} />}
          title="数据管理"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text">缓存大小</p>
              <p className="mt-0.5 text-xs text-text-secondary">本地数据与分析缓存</p>
            </div>
            <span className="font-mono text-lg font-bold text-text">
              {dbSize >= 1024 * 1024
                ? `${(dbSize / (1024 * 1024)).toFixed(1)} MB`
                : `${(dbSize / 1024).toFixed(1)} KB`}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={async () => {
                await fullReset()
                window.location.reload()
              }}
              className={cn(
                'rounded-[12px] border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-text',
                'cursor-pointer transition-colors hover:bg-surface-hover'
              )}
            >
              清除缓存
            </button>
            <button
              className={cn(
                'rounded-[12px] border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-text',
                'cursor-pointer transition-colors hover:bg-surface-hover'
              )}
            >
              导出数据
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
