/**
 * AI 配置引导守卫
 *
 * 当 aiVerified === false 时，在所有应用页面（/settings 除外）上覆盖一个全屏引导层，
 * 强制用户完成 AI 服务商配置并测试通过后才能使用产品的核心功能。
 *
 * 设计思路：
 * - 步骤1：选择服务商
 * - 步骤2：填写 API Key + 可选 Base URL / Model 覆盖
 * - 步骤3：测试连接 → 成功后自动放行
 */

import { useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Bot,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  ExternalLink,
  Check,
  X,
  Loader2,
  Sparkles,
  ShieldCheck,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettingsStore, AI_PROVIDERS, getProviderConfig } from '@/stores/settings'
import type { ProviderId } from '@/stores/settings'

/* ─── styles ─── */

const inputClass = cn(
  'w-full rounded-[12px] border border-border bg-white/80 dark:bg-white/5',
  'px-3.5 py-2.5 text-sm text-text outline-none',
  'focus:border-border-focus focus:ring-2 focus:ring-primary/20',
  'placeholder:text-text-muted'
)

/* ─── guard wrapper ─── */

export function AISetupGuard({ children }: { children: React.ReactNode }) {
  const aiVerified = useSettingsStore((s) => s.aiVerified)
  const location = useLocation()

  // 设置页面自身不需要引导遮罩
  const isSettingsPage = location.pathname === '/settings'

  if (aiVerified || isSettingsPage) {
    return <>{children}</>
  }

  return (
    <>
      {children}
      <SetupOverlay />
    </>
  )
}

/* ─── 全屏引导浮层 ─── */

function SetupOverlay() {
  const navigate = useNavigate()
  const { aiConfig, setAIConfig, setAIVerified } = useSettingsStore()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testError, setTestError] = useState('')

  function handleSelectProvider(id: ProviderId) {
    const config = getProviderConfig(id)
    setAIConfig({
      provider: id,
      model: config.defaultModel,
      baseUrl: config.defaultBaseUrl,
    })
    setStep(2)
  }

  const handleTestConnection = useCallback(async () => {
    if (!aiConfig.apiKey) {
      setTestStatus('error')
      setTestError('请填写 API Key')
      return
    }
    if (!aiConfig.model) {
      setTestStatus('error')
      setTestError('请填写模型名称')
      return
    }

    setTestStatus('testing')
    setTestError('')

    try {
      const { createModel } = await import('@/ai/model-factory')
      const model = createModel(aiConfig)
      await model.invoke([{ role: 'user', content: 'hi' }])
      setTestStatus('success')
      setAIVerified(true)
    } catch (err) {
      setTestStatus('error')
      try {
        const { handleAIError } = await import('@/ai/error-handler')
        setTestError(handleAIError(err).message)
      } catch {
        setTestError(err instanceof Error ? err.message : String(err))
      }
    }
  }, [aiConfig, setAIVerified])

  const currentProvider = getProviderConfig(aiConfig.provider)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4">
        {/* card */}
        <div className="rounded-[24px] border border-border bg-surface shadow-xl overflow-hidden">
          {/* header */}
          <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-8 pt-8 pb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-primary text-white shadow-md">
                <Sparkles className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-text">配置 AI 服务</h1>
                <p className="text-sm text-text-secondary">GitPulse 需要连接 AI 大模型才能正常工作</p>
              </div>
            </div>

            {/* stepper */}
            <div className="flex items-center gap-2 mt-4">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      step === s
                        ? 'bg-primary text-white'
                        : step > s
                          ? 'bg-accent text-white'
                          : 'bg-border text-text-muted'
                    )}
                  >
                    {step > s ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : s}
                  </div>
                  {s < 3 && (
                    <div
                      className={cn(
                        'h-0.5 w-8 rounded-full transition-colors',
                        step > s ? 'bg-accent' : 'bg-border'
                      )}
                    />
                  )}
                </div>
              ))}
              <span className="ml-2 text-xs text-text-muted">
                {step === 1 ? '选择服务商' : step === 2 ? '填写配置' : '验证连接'}
              </span>
            </div>
          </div>

          {/* body */}
          <div className="px-8 py-6">
            {step === 1 && (
              <StepSelectProvider onSelect={handleSelectProvider} current={aiConfig.provider} />
            )}

            {step === 2 && (
              <StepConfigure
                aiConfig={aiConfig}
                setAIConfig={setAIConfig}
                currentProvider={currentProvider}
                showKey={showKey}
                setShowKey={setShowKey}
              />
            )}

            {step === 3 && (
              <StepVerify
                testStatus={testStatus}
                testError={testError}
                onTest={handleTestConnection}
                aiConfig={aiConfig}
                currentProvider={currentProvider}
              />
            )}
          </div>

          {/* footer */}
          <div className="flex items-center justify-between border-t border-border px-8 py-4">
            <div>
              {step > 1 && testStatus !== 'success' && (
                <button
                  onClick={() => setStep((s) => (s > 1 ? (s - 1) as 1 | 2 : s))}
                  className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
                  上一步
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/settings')}
                className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary cursor-pointer"
              >
                <Settings className="h-3.5 w-3.5" strokeWidth={1.75} />
                高级设置
              </button>

              {step === 2 && (
                <button
                  onClick={() => setStep(3)}
                  disabled={!aiConfig.apiKey || !aiConfig.model}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-[12px] px-5 py-2.5 text-sm font-semibold',
                    'bg-primary text-primary-foreground cursor-pointer hover:opacity-90',
                    'disabled:opacity-40 disabled:cursor-not-allowed'
                  )}
                >
                  下一步
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}

              {step === 3 && testStatus === 'success' && (
                <button
                  onClick={() => navigate('/')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-[12px] px-5 py-2.5 text-sm font-semibold',
                    'bg-accent text-white cursor-pointer hover:opacity-90'
                  )}
                >
                  <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
                  开始使用
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Step 1: 选择服务商 ─── */

function StepSelectProvider({
  onSelect,
  current,
}: {
  onSelect: (id: ProviderId) => void
  current: ProviderId
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary mb-4">
        选择你的 AI 服务商，所有 OpenAI 兼容接口均可使用。
        <a
          href="https://models.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline ml-1"
        >
          查看更多
          <ExternalLink className="h-3 w-3" />
        </a>
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        {AI_PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={cn(
              'flex items-center gap-3 rounded-[14px] border px-4 py-3 text-left',
              'cursor-pointer transition-all hover:shadow-sm',
              current === p.id
                ? 'border-primary bg-primary-soft shadow-sm'
                : 'border-border bg-background hover:bg-surface-hover'
            )}
          >
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-[10px] text-xs font-bold',
                current === p.id ? 'bg-primary text-white' : 'bg-surface text-text-secondary'
              )}
            >
              {p.label.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text truncate">{p.label}</p>
              {p.defaultModel && (
                <p className="text-xs text-text-muted truncate">{p.defaultModel}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Step 2: 填写配置 ─── */

function StepConfigure({
  aiConfig,
  setAIConfig,
  currentProvider,
  showKey,
  setShowKey,
}: {
  aiConfig: { provider: ProviderId; apiKey: string; model: string; baseUrl: string }
  setAIConfig: (c: Record<string, string>) => void
  currentProvider: ReturnType<typeof getProviderConfig>
  showKey: boolean
  setShowKey: (v: boolean) => void
}) {
  const needsBaseUrl = currentProvider.id === 'custom'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="h-4 w-4 text-primary" strokeWidth={1.75} />
        <span className="text-sm font-semibold text-text">{currentProvider.label}</span>
        {currentProvider.defaultBaseUrl && (
          <span className="text-xs text-text-muted">({currentProvider.defaultBaseUrl})</span>
        )}
      </div>

      {/* API Key */}
      <div>
        <label className="block text-sm font-semibold text-text mb-1.5">API Key *</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={aiConfig.apiKey}
            onChange={(e) => setAIConfig({ apiKey: e.target.value })}
            placeholder="sk-..."
            autoFocus
            className={cn(inputClass, 'pr-11')}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary cursor-pointer"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Base URL */}
      {(needsBaseUrl || aiConfig.baseUrl) && (
        <div>
          <label className="block text-sm font-semibold text-text mb-1.5">
            Base URL {needsBaseUrl && '*'}
          </label>
          <input
            type="text"
            value={aiConfig.baseUrl}
            onChange={(e) => setAIConfig({ baseUrl: e.target.value })}
            placeholder={currentProvider.defaultBaseUrl || 'https://api.example.com/v1'}
            className={inputClass}
          />
          {currentProvider.defaultBaseUrl && !aiConfig.baseUrl && (
            <p className="text-xs text-text-muted mt-1">默认: {currentProvider.defaultBaseUrl}</p>
          )}
        </div>
      )}

      {/* Model */}
      <div>
        <label className="block text-sm font-semibold text-text mb-1.5">模型 *</label>
        <input
          type="text"
          value={aiConfig.model}
          onChange={(e) => setAIConfig({ model: e.target.value })}
          placeholder="输入模型名称"
          className={inputClass}
        />
        <p className="text-xs text-text-muted mt-1">当前: {aiConfig.model || '未设置'}</p>
      </div>
    </div>
  )
}

/* ─── Step 3: 验证连接 ─── */

function StepVerify({
  testStatus,
  testError,
  onTest,
  aiConfig,
  currentProvider,
}: {
  testStatus: 'idle' | 'testing' | 'success' | 'error'
  testError: string
  onTest: () => void
  aiConfig: { provider: ProviderId; model: string; baseUrl: string }
  currentProvider: ReturnType<typeof getProviderConfig>
}) {
  return (
    <div className="space-y-5">
      {/* summary */}
      <div className="rounded-[14px] border border-border bg-background p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">服务商</span>
          <span className="font-semibold text-text">{currentProvider.label}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">模型</span>
          <span className="font-mono text-xs text-text">{aiConfig.model}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">API 端点</span>
          <span className="text-xs text-text truncate max-w-[200px]">
            {aiConfig.baseUrl || currentProvider.defaultBaseUrl || '默认'}
          </span>
        </div>
      </div>

      {/* test button */}
      <div className="flex flex-col items-center gap-3">
        {testStatus === 'success' ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
              <ShieldCheck className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <p className="text-sm font-semibold text-accent">连接验证成功！</p>
            <p className="text-xs text-text-muted">AI 服务已准备就绪，点击「开始使用」进入应用</p>
          </div>
        ) : (
          <>
            <button
              onClick={onTest}
              disabled={testStatus === 'testing'}
              className={cn(
                'inline-flex items-center gap-2 rounded-[14px] px-8 py-3 text-sm font-semibold',
                'cursor-pointer transition-all',
                testStatus === 'error'
                  ? 'bg-danger/10 text-danger hover:bg-danger/15'
                  : 'bg-primary text-primary-foreground hover:opacity-90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {testStatus === 'testing' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在测试连接...
                </>
              ) : testStatus === 'error' ? (
                <>
                  <X className="h-4 w-4" />
                  重新测试
                </>
              ) : (
                '测试连接'
              )}
            </button>

            {testError && (
              <div className="w-full rounded-[12px] bg-danger/5 border border-danger/20 px-4 py-3">
                <p className="text-xs text-danger">{testError}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
