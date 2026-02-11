import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Lightbulb,
  Send,
  FileText,
  BarChart3,
  Download,
  Square,
  Loader2,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDBStore } from '@/stores/db-store'
import { useChatStore } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'
import { useAIChat } from '@/hooks/useAIChat'
import { PageHeader } from '@/components/ui/page-header'
import { Markdown } from '@/components/ui/markdown'

/* ─── constants ─── */

type Category = 'all' | 'risk' | 'highlight' | 'trend' | 'suggest'

const categories: { key: Category; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'risk', label: '风险' },
  { key: 'highlight', label: '亮点' },
  { key: 'trend', label: '趋势' },
  { key: 'suggest', label: '建议' },
]

const categoryBorderColor: Record<string, string> = {
  risk: 'var(--danger)',
  highlight: 'var(--accent)',
  trend: 'var(--secondary)',
  suggest: 'var(--primary)',
}

const categoryDotColor: Record<string, string> = {
  risk: 'bg-danger',
  highlight: 'bg-accent',
  trend: 'bg-secondary',
  suggest: 'bg-primary',
}

const categoryIcon: Record<string, React.ReactNode> = {
  risk: <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />,
  highlight: <Sparkles className="h-5 w-5" strokeWidth={1.75} />,
  trend: <TrendingUp className="h-5 w-5" strokeWidth={1.75} />,
  suggest: <Lightbulb className="h-5 w-5" strokeWidth={1.75} />,
}

/* ─── page ─── */

export default function InsightsPage() {
  const [activeFilter, setActiveFilter] = useState<Category>('all')
  const [inputValue, setInputValue] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [reportLoading, setReportLoading] = useState<string | null>(null)

  const { messages, clearMessages } = useChatStore()
  const { insights } = useDBStore()
  const apiKey = useSettingsStore((s) => s.aiConfig.apiKey)

  const { send, stop, streaming, error, currentToolCalls } = useAIChat()

  const filtered =
    activeFilter === 'all'
      ? insights
      : insights.filter((ins) => ins.category === activeFilter)

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text || streaming) return
    setInputValue('')
    send(text)
  }, [inputValue, streaming, send])

  const handleReport = useCallback(async (type: 'weekly' | 'monthly' | 'full') => {
    if (streaming || !apiKey) return
    setReportLoading(type)
    const prompts = {
      weekly: '请生成本周的仓库分析周报',
      monthly: '请生成本月的仓库分析月报',
      full: '请生成完整的仓库分析报告',
    }
    await send(prompts[type])
    setReportLoading(null)
  }, [streaming, apiKey, send])

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Sparkles className="h-5 w-5" strokeWidth={1.75} />}
        title="AI 洞察"
      />

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setActiveFilter(c.key)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer',
              activeFilter === c.key
                ? 'bg-primary-soft text-primary'
                : 'bg-surface text-text-secondary hover:bg-surface-hover'
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Insight cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.map((ins, idx) => (
          <div
            key={ins.id ?? `insight-${idx}`}
            className="rounded-[16px] border border-border bg-surface p-5"
            style={{ borderLeftWidth: 4, borderLeftColor: categoryBorderColor[ins.category] }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                style={{
                  backgroundColor: `color-mix(in srgb, ${categoryBorderColor[ins.category]} 15%, transparent)`,
                  color: categoryBorderColor[ins.category],
                }}
              >
                {categoryIcon[ins.category]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading text-sm font-semibold text-text">{ins.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                  {ins.description}
                </p>
                {/* Severity dots */}
                <div className="mt-3 flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-2 w-2 rounded-full',
                        i < ins.severity
                          ? categoryDotColor[ins.category]
                          : 'bg-border'
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div className="bg-surface rounded-[20px] border border-border flex flex-col overflow-hidden" style={{ minHeight: 360 }}>
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold text-text">AI 对话</h2>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-xs text-text-muted hover:text-text-secondary cursor-pointer transition-colors"
            >
              清空对话
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">
              {apiKey
                ? '向 AI 提问关于团队数据的任何问题...'
                : '请先在设置中配置 AI API Key，即可开始 AI 对话'}
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'max-w-[85%] rounded-[12px] px-4 py-2.5',
                msg.role === 'user'
                  ? 'ml-auto bg-primary text-primary-foreground text-sm leading-relaxed'
                  : 'mr-auto bg-surface-hover text-text'
              )}
            >
              {msg.content ? (
                msg.role === 'assistant' ? (
                  <Markdown>{msg.content}</Markdown>
                ) : (
                  msg.content
                )
              ) : (
                streaming && msg.role === 'assistant' && (
                  <span className="inline-flex items-center gap-1.5 text-text-muted text-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                    思考中...
                  </span>
                )
              )}
            </div>
          ))}

          {/* Tool call indicator */}
          {currentToolCalls.length > 0 && (
            <div className="mr-auto flex items-center gap-2 rounded-[12px] bg-secondary-soft px-4 py-2 text-xs text-secondary">
              <Wrench className="h-3.5 w-3.5" strokeWidth={2} />
              正在查询: {currentToolCalls.join(', ')}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mr-auto rounded-[12px] bg-danger/10 px-4 py-2 text-xs text-danger">
              {error.message}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border px-4 py-3 flex items-center gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={apiKey ? '输入问题...' : '请先配置 API Key'}
            disabled={!apiKey}
            className={cn(
              'flex-1 rounded-[12px] border border-border bg-background px-4 py-2.5 text-sm text-text',
              'outline-none focus:border-border-focus focus:ring-2 focus:ring-primary/20',
              'placeholder:text-text-muted',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
          {streaming ? (
            <button
              onClick={stop}
              aria-label="停止生成"
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger text-white',
                'cursor-pointer transition-opacity hover:opacity-90'
              )}
            >
              <Square className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!apiKey || !inputValue.trim()}
              aria-label="发送消息"
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground',
                'cursor-pointer transition-opacity hover:opacity-90',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              <Send className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {/* Report buttons */}
      <div className="flex flex-wrap gap-3">
        {([
          { label: '生成周报', icon: <FileText className="h-4 w-4" strokeWidth={1.75} />, type: 'weekly' as const },
          { label: '月度分析', icon: <BarChart3 className="h-4 w-4" strokeWidth={1.75} />, type: 'monthly' as const },
          { label: '完整报告', icon: <Download className="h-4 w-4" strokeWidth={1.75} />, type: 'full' as const },
        ]).map((btn) => (
          <button
            key={btn.label}
            onClick={() => handleReport(btn.type)}
            disabled={streaming || !apiKey}
            className={cn(
              'inline-flex items-center gap-2 rounded-[12px] border border-border bg-surface px-5 py-2.5',
              'text-sm font-semibold text-text',
              'cursor-pointer transition-colors hover:bg-surface-hover',
              'shadow-[var(--shadow-card)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {reportLoading === btn.type ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              btn.icon
            )}
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  )
}
