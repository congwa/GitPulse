/**
 * 工贼检测中心 — 主页面
 *
 * 设计对齐 Dashboard / Team 页面风格：
 * - rounded-[20px] / rounded-[16px] cards with shadow-[var(--shadow-card)]
 * - Bento grid layout
 * - 复用 PageHeader / StatCard / EmptyState / Tag / ProgressBar / AIInsightCard
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search,
  Play,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Flame,
  RefreshCw,
  Trash2,
  Crown,
  FileWarning,
  Zap,
  TrendingDown,
  Sparkles,
  Terminal,
  CheckCircle2,
  XCircle,
  CircleDot,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Tag } from '@/components/ui/tag'
import { ProgressBar } from '@/components/ui/progress-bar'
import { AIInsightCard } from '@/components/ui/ai-insight-card'
import { Markdown } from '@/components/ui/markdown'
import { useWasteStore } from '@/stores/waste-store'
import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/project'
import { WASTE_PATTERNS, type WasteEvent } from '@/ai/deepagent/types'
import type { ActivityItem } from '@/ai/deepagent/activity-channel'

/* ─── severity config ─── */

const severityConfig = {
  high: { variant: 'danger' as const, label: '高危' },
  medium: { variant: 'accent' as const, label: '中等' },
  low: { variant: 'muted' as const, label: '低' },
}

const patternTagVariant: Record<string, 'primary' | 'secondary' | 'accent' | 'danger' | 'muted'> = {
  W1: 'danger',
  W2: 'accent',
  W3: 'danger',
  W4: 'secondary',
  W5: 'danger',
  W6: 'accent',
  W7: 'primary',
}

/* ─── 格式化相对时间 ─── */

function formatElapsed(startedAt: number, timestamp: number): string {
  const sec = Math.max(0, Math.floor((timestamp - startedAt) / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/* ─── 活动行图标 ─── */

function ActivityIcon({ type }: { type: ActivityItem['type'] }) {
  switch (type) {
    case 'phase':
      return <ArrowRight className="h-3 w-3 text-primary" strokeWidth={2} />
    case 'task-start':
      return <CircleDot className="h-3 w-3 text-secondary" strokeWidth={2} />
    case 'task-complete':
      return <CheckCircle2 className="h-3 w-3 text-accent" strokeWidth={2} />
    case 'task-error':
      return <XCircle className="h-3 w-3 text-danger" strokeWidth={2} />
    case 'tool-call':
      return <Terminal className="h-3 w-3 text-text-muted" strokeWidth={2} />
    case 'info':
      return <Sparkles className="h-3 w-3 text-accent" strokeWidth={2} />
    default:
      return <CircleDot className="h-3 w-3 text-text-muted" strokeWidth={2} />
  }
}

/* ─── 单条活动行 ─── */

function ActivityLine({ item, startedAt }: { item: ActivityItem; startedAt: number }) {
  const isPhase = item.type === 'phase'
  const isTask = item.type === 'task-start' || item.type === 'task-complete' || item.type === 'task-error'
  const isTool = item.type === 'tool-call'

  return (
    <div
      className={cn(
        'flex items-start gap-2 py-1',
        isPhase && 'pt-2 pb-1',
      )}
    >
      {/* 时间戳 */}
      <span className="w-10 shrink-0 text-[10px] font-mono text-text-muted tabular-nums leading-[18px]">
        {formatElapsed(startedAt, item.timestamp)}
      </span>

      {/* 图标 */}
      <span className="mt-[3px] shrink-0">
        <ActivityIcon type={item.type} />
      </span>

      {/* 内容 */}
      <div className="min-w-0 flex-1">
        {isPhase ? (
          <p className="text-xs font-semibold text-text leading-[18px]">
            {item.message}
          </p>
        ) : isTask ? (
          <div>
            <p className={cn(
              'text-xs leading-[18px]',
              item.type === 'task-start' && 'font-medium text-text',
              item.type === 'task-complete' && 'font-medium text-accent',
              item.type === 'task-error' && 'font-medium text-danger',
            )}>
              {item.message}
            </p>
            {item.detail && (
              <p className="text-[10px] text-text-muted leading-tight mt-0.5 truncate">
                {item.detail}
              </p>
            )}
          </div>
        ) : isTool ? (
          <p className="font-mono text-[11px] text-text-secondary leading-[18px] truncate" title={item.detail || item.message}>
            <span className="text-text-muted select-none">$ </span>
            {item.message}
          </p>
        ) : (
          <p className="text-xs text-text-secondary leading-[18px] truncate">
            {item.message}
          </p>
        )}
      </div>
    </div>
  )
}

/* ─── 实时活动流 ─── */

function ActivityFeed() {
  const activities = useWasteStore((s) => s.activities)
  const startedAt = useWasteStore((s) => s.analysisStartedAt)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [userScrolled, setUserScrolled] = useState(false)

  // 自动滚动到底部
  useEffect(() => {
    if (!userScrolled && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activities.length, userScrolled])

  // 检测用户是否手动滚动
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    // 距离底部 40px 以内认为是"在底部"
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40
    setUserScrolled(!isAtBottom)
  }, [])

  if (activities.length === 0) return null

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="text-xs font-semibold text-text-muted">实时动态</span>
        </div>
        <span className="text-[10px] text-text-muted font-mono">
          {activities.length} 条
        </span>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          'max-h-[240px] overflow-y-auto overflow-x-hidden',
          'rounded-[12px] bg-surface-alt border border-border/60',
          'px-3 py-2',
          // 自定义滚动条
          'scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent',
        )}
      >
        {activities.map((item) => (
          <ActivityLine key={item.id} item={item} startedAt={startedAt} />
        ))}

        {/* 底部脉冲指示器 */}
        <div className="flex items-center gap-2 py-1 opacity-60">
          <span className="w-10 shrink-0" />
          <Loader2 className="h-3 w-3 animate-spin text-text-muted" strokeWidth={2} />
          <span className="text-[10px] text-text-muted">执行中...</span>
        </div>
      </div>

      {/* 回到底部按钮 */}
      {userScrolled && (
        <button
          onClick={() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight
              setUserScrolled(false)
            }
          }}
          className={cn(
            'mt-1.5 flex items-center gap-1 text-[10px] text-primary',
            'hover:underline cursor-pointer',
          )}
        >
          <ChevronDown className="h-3 w-3" strokeWidth={2} />
          跳到最新
        </button>
      )}
    </div>
  )
}

/* ─── Analysis Progress Card ─── */

function AnalysisProgress() {
  const progress = useWasteStore((s) => s.progress)
  const isAnalyzing = useWasteStore((s) => s.isAnalyzing)
  const activities = useWasteStore((s) => s.activities)

  // 分析中或刚完成（有活动记录）都显示
  if (!progress && activities.length === 0) return null
  if (!isAnalyzing && (!progress || progress.percent === 100) && activities.length === 0) return null

  // 计算当前正在进行的 SubAgent
  const lastTaskStart = [...activities].reverse().find(a => a.type === 'task-start')
  const lastTaskEnd = [...activities].reverse().find(a => a.type === 'task-complete' || a.type === 'task-error')
  const currentTask = lastTaskStart && (!lastTaskEnd || lastTaskStart.id > lastTaskEnd.id)
    ? lastTaskStart.message
    : null

  // 统计信息
  const toolCallCount = activities.filter(a => a.type === 'tool-call').length
  const taskCompleteCount = activities.filter(a => a.type === 'task-complete').length

  return (
    <div className="rounded-[20px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary-soft">
          {isAnalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" strokeWidth={1.75} />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-accent" strokeWidth={1.75} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading text-sm font-semibold text-text truncate">
            {progress?.message || '准备中...'}
          </p>
          <p className="text-xs text-text-muted mt-0.5">
            {progress?.stage === 'pre-scan' && '预扫描阶段'}
            {progress?.stage === 'deep-analysis' && '深度分析阶段'}
            {progress?.stage === 'report' && '生成报告中'}
            {currentTask && (
              <span className="ml-1.5 text-secondary">
                · 当前: {currentTask}
              </span>
            )}
          </p>
        </div>
        <span className="font-mono text-sm font-bold text-primary">{progress?.percent ?? 0}%</span>
      </div>

      {/* Progress bar */}
      <ProgressBar percent={progress?.percent ?? 0} />

      {/* Stats chips */}
      {(toolCallCount > 0 || taskCompleteCount > 0) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {taskCompleteCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-medium text-accent">
              <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
              {taskCompleteCount} 个 Agent 完成
            </span>
          )}
          {toolCallCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-0.5 text-[10px] font-medium text-secondary">
              <Terminal className="h-3 w-3" strokeWidth={2} />
              {toolCallCount} 次命令执行
            </span>
          )}
          {progress?.eventsFound ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-0.5 text-[10px] font-medium text-warning">
              <AlertTriangle className="h-3 w-3" strokeWidth={2} />
              {progress.eventsFound} 个事件
            </span>
          ) : null}
        </div>
      )}

      {/* Activity Feed */}
      {isAnalyzing && <ActivityFeed />}
    </div>
  )
}

/* ─── Ranking Table (Card Rows, like Team page) ─── */

function RankingTable() {
  const scores = useWasteStore((s) => s.scores)

  if (scores.length === 0) return null

  return (
    <div className="rounded-[20px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-4 font-heading text-sm font-semibold text-text flex items-center gap-2">
        <Flame className="h-4 w-4 text-danger" strokeWidth={1.75} />
        工贼排行榜
      </h2>

      {/* Header */}
      <div className="mb-2 grid grid-cols-[40px_1fr_80px_80px_80px_1fr] gap-3 px-4 text-xs font-semibold text-text-muted">
        <span>#</span>
        <span>成员</span>
        <span className="text-right">浪费评分</span>
        <span className="text-right">浪费率</span>
        <span className="text-right">浪费行数</span>
        <span>模式标签</span>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-2">
        {scores.map((s, i) => (
          <div
            key={s.authorEmail}
            className={cn(
              'grid grid-cols-[40px_1fr_80px_80px_80px_1fr] items-center gap-3 px-4 py-3',
              'bg-surface rounded-[12px] border border-border',
              'transition-colors duration-150 hover:bg-surface-hover',
            )}
          >
            {/* Rank */}
            <span className="flex items-center justify-center">
              {i === 0 ? (
                <Crown className="h-5 w-5 text-danger" strokeWidth={1.75} />
              ) : (
                <span className="font-mono text-sm text-text-muted">#{i + 1}</span>
              )}
            </span>

            {/* Name */}
            <div className="min-w-0">
              <p className="font-semibold text-sm text-text truncate">
                {s.authorName || s.authorEmail}
              </p>
              <p className="text-xs text-text-muted truncate">{s.authorEmail}</p>
            </div>

            {/* Waste Score */}
            <span
              className={cn(
                'text-right font-mono text-sm font-bold',
                s.wasteScore >= 60
                  ? 'text-danger'
                  : s.wasteScore >= 30
                    ? 'text-warning'
                    : 'text-text-secondary',
              )}
            >
              {s.wasteScore.toFixed(0)}
            </span>

            {/* Waste Rate */}
            <span className="text-right font-mono text-sm text-text-secondary">
              {(s.wasteRate * 100).toFixed(1)}%
            </span>

            {/* Lines Wasted */}
            <span className="text-right font-mono text-sm text-danger">
              {s.totalLinesWasted > 1000
                ? `${(s.totalLinesWasted / 1000).toFixed(1)}k`
                : s.totalLinesWasted.toLocaleString()}
            </span>

            {/* Pattern Tags */}
            <span className="flex flex-wrap gap-1.5">
              {Object.entries(s.patternCounts).map(([pid, count]) => (
                <Tag
                  key={pid}
                  variant={patternTagVariant[pid] ?? 'muted'}
                >
                  {pid} x{count as number}
                </Tag>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Event Card ─── */

function EventCard({ event }: { event: WasteEvent }) {
  const [expanded, setExpanded] = useState(false)
  const pattern = WASTE_PATTERNS[event.patternId]
  const sev = severityConfig[event.severity]

  return (
    <div
      className={cn(
        'rounded-[16px] border border-border bg-surface overflow-hidden',
        'shadow-[var(--shadow-card)]',
        'transition-all duration-200',
        expanded && 'shadow-[var(--shadow-card-hover)]',
      )}
    >
      {/* Header (clickable) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-surface-hover transition-colors text-left cursor-pointer"
      >
        <Tag variant={sev.variant}>{sev.label}</Tag>
        <Tag variant={patternTagVariant[event.patternId] ?? 'muted'}>
          {event.patternId} {pattern.name}
        </Tag>

        <span className="text-sm text-text flex-1 truncate">{event.description}</span>

        <span className="text-xs font-mono text-text-secondary whitespace-nowrap">
          {event.linesWasted > 1000
            ? `${(event.linesWasted / 1000).toFixed(1)}k`
            : event.linesWasted}{' '}
          行
          {event.wasPassive && (
            <span className="ml-1 text-text-muted">(被动)</span>
          )}
        </span>

        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-text-muted hover:text-primary hover:bg-primary-soft transition-colors">
          {expanded ? (
            <ChevronUp className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-border space-y-4 pt-4">
          {/* Meta grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-[10px] bg-surface-alt p-3">
              <span className="text-text-muted block mb-0.5">责任人</span>
              <span className="text-text font-medium">{event.authorEmail}</span>
            </div>
            <div className="rounded-[10px] bg-surface-alt p-3">
              <span className="text-text-muted block mb-0.5">相关人员</span>
              <span className="text-text">
                {event.relatedAuthors.length > 0
                  ? event.relatedAuthors.join(', ')
                  : '无'}
              </span>
            </div>
            <div className="rounded-[10px] bg-surface-alt p-3 sm:col-span-2">
              <span className="text-text-muted block mb-0.5">涉及文件</span>
              <span className="text-text font-mono text-[11px] leading-relaxed">
                {event.filePaths.join(', ')}
              </span>
            </div>
          </div>

          {/* Evidence */}
          {event.evidence && (
            <div>
              <p className="text-xs font-semibold text-text-muted mb-2">关键证据</p>
              <div className="rounded-[12px] bg-surface-alt border border-border p-4 text-xs font-mono text-text-secondary overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {event.evidence}
              </div>
            </div>
          )}

          {/* Root cause */}
          {event.rootCause && (
            <div>
              <p className="text-xs font-semibold text-text-muted mb-1.5">根因分析</p>
              <p className="text-sm text-text-secondary leading-relaxed">{event.rootCause}</p>
            </div>
          )}

          {/* Recommendation */}
          {event.recommendation && (
            <div className="rounded-[12px] border-l-[3px] border-l-primary bg-primary-soft p-4">
              <p className="text-xs font-semibold text-primary mb-1">改善建议</p>
              <p className="text-sm text-text leading-relaxed">{event.recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Main Page ─── */

export default function WastePage() {
  const { report, events, scores, isAnalyzing, error, startAnalysis, loadFromDB, clear } =
    useWasteStore()
  const aiConfig = useSettingsStore((s) => s.aiConfig)
  const aiVerified = useSettingsStore((s) => s.aiVerified)
  const repoPath = useProjectStore((s) => s.repoPath)

  // 加载已有结果
  useEffect(() => {
    loadFromDB()
  }, [loadFromDB])

  const handleStartAnalysis = useCallback(async () => {
    if (!repoPath) return
    await startAnalysis(aiConfig, repoPath)
  }, [aiConfig, repoPath, startAnalysis])

  const hasResults = events.length > 0 || report !== null

  // 计算统计数据
  const totalLinesWasted = scores.reduce((s, m) => s + m.totalLinesWasted, 0)
  const avgWasteRate =
    scores.length > 0
      ? scores.reduce((s, m) => s + m.wasteRate, 0) / scores.length
      : 0
  const highSeverityCount = events.filter((e) => e.severity === 'high').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        icon={<Search className="h-5 w-5" strokeWidth={1.75} />}
        title="工贼检测中心"
      >
        {/* Action buttons in header right slot */}
        <div className="flex items-center gap-2">
          {hasResults && (
            <>
              <button
                onClick={handleStartAnalysis}
                disabled={isAnalyzing}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5',
                  'text-xs font-semibold text-text-secondary',
                  'hover:text-text hover:bg-surface-alt',
                  'cursor-pointer transition-colors',
                  isAnalyzing && 'opacity-50 cursor-not-allowed',
                )}
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                重新分析
              </button>
              <button
                onClick={clear}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5',
                  'text-xs font-semibold text-text-muted',
                  'hover:text-danger hover:bg-danger/5',
                  'cursor-pointer transition-colors',
                )}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                清除
              </button>
            </>
          )}

          <button
            onClick={handleStartAnalysis}
            disabled={isAnalyzing || !aiVerified || !repoPath}
            className={cn(
              'inline-flex items-center gap-2 rounded-[12px] px-5 py-2.5 text-sm font-semibold',
              'cursor-pointer transition-all duration-200',
              isAnalyzing
                ? 'bg-surface-alt text-text-muted cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:opacity-90',
            )}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                分析中...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" strokeWidth={1.75} />
                启动深度分析
              </>
            )}
          </button>
        </div>
      </PageHeader>

      {/* Warnings */}
      {(!aiVerified || !repoPath) && (
        <div className="flex items-center gap-4">
          {!aiVerified && (
            <div className="flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
              请先在设置中配置 AI
            </div>
          )}
          {!repoPath && (
            <div className="flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
              请先选择 Git 仓库
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-[16px] border border-danger/30 bg-danger/5 p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-danger/10 text-danger">
              <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-semibold text-danger">分析失败</p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      <AnalysisProgress />

      {/* Stat cards (Bento Grid Row 1) */}
      {hasResults && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<FileWarning className="h-5 w-5" strokeWidth={1.75} />}
            label="无用功事件"
            value={events.length}
          />
          <StatCard
            icon={<Zap className="h-5 w-5" strokeWidth={1.75} />}
            label="高危事件"
            value={highSeverityCount}
          />
          <StatCard
            icon={<TrendingDown className="h-5 w-5" strokeWidth={1.75} />}
            label="浪费代码行"
            value={
              totalLinesWasted > 1000
                ? `${(totalLinesWasted / 1000).toFixed(1)}k`
                : totalLinesWasted.toLocaleString()
            }
          />
          <StatCard
            icon={<Flame className="h-5 w-5" strokeWidth={1.75} />}
            label="平均浪费率"
            value={`${(avgWasteRate * 100).toFixed(1)}%`}
          />
        </div>
      )}

      {/* AI Summary (full width, AIInsightCard) */}
      {report && (
        <AIInsightCard
          icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
          title="AI 分析总结"
          variant="portrait"
        >
          <div>
            <div className="text-sm text-text-secondary leading-relaxed">
              <Markdown>{report.summary}</Markdown>
            </div>

            {report.teamRecommendations.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-text-muted">团队改善建议</p>
                {report.teamRecommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-sm text-text-secondary leading-relaxed"
                  >
                    <span className="font-mono text-xs font-bold text-primary mt-0.5">
                      {i + 1}.
                    </span>
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            )}

            {report.analysisStats && (
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-muted">
                <span>
                  分析文件:{' '}
                  <span className="font-mono text-text-secondary">
                    {report.analysisStats.filesAnalyzed}
                  </span>
                </span>
                <span>
                  扫描提交:{' '}
                  <span className="font-mono text-text-secondary">
                    {report.analysisStats.commitsScanned}
                  </span>
                </span>
                <span>
                  耗时:{' '}
                  <span className="font-mono text-text-secondary">
                    {(report.analysisStats.durationMs / 1000).toFixed(1)}s
                  </span>
                </span>
              </div>
            )}
          </div>
        </AIInsightCard>
      )}

      {/* Ranking */}
      <RankingTable />

      {/* Events */}
      {events.length > 0 && (
        <div className="rounded-[20px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="mb-4 font-heading text-sm font-semibold text-text flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" strokeWidth={1.75} />
            无用功事件详情
            <span className="text-xs font-normal text-text-muted">({events.length} 个事件)</span>
          </h2>
          <div className="space-y-3">
            {events
              .sort((a, b) => {
                const sOrder = { high: 0, medium: 1, low: 2 }
                return (
                  sOrder[a.severity] - sOrder[b.severity] ||
                  b.linesWasted - a.linesWasted
                )
              })
              .map((event, i) => (
                <EventCard key={event.id ?? i} event={event} />
              ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasResults && !isAnalyzing && (
        <EmptyState
          icon={<Search className="h-7 w-7" strokeWidth={1.75} />}
          title="暂无检测数据"
          description="点击「启动深度分析」，DeepAgent 将阅读源码、追踪 Git 历史，深度分析团队的代码浪费情况"
          actionTo=""
          actionLabel=""
        />
      )}
    </div>
  )
}
