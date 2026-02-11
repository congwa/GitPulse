import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, Circle, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore, type AIConfig } from '@/stores/settings'
import { useDBStore } from '@/stores/db-store'
import { getDB } from '@/lib/database'
import { fetchGitCommits, ingestCommits, isTauri, getGitLogCommand } from '@/lib/git'
import type { IngestProgress } from '@/lib/git'
import { handleAIError } from '@/ai/error-handler'

// ============================================
// Stage 定义
// ============================================

type StageStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'

interface Stage {
  key: string
  label: string
  status: StageStatus
  result: string
}

const INITIAL_STAGES: Stage[] = [
  { key: 'git_fetch', label: '读取 Git 日志', status: 'pending', result: '' },
  { key: 'parse', label: '解析提交记录', status: 'pending', result: '' },
  { key: 'aggregate', label: '统计数据聚合', status: 'pending', result: '' },
  { key: 'persist', label: '数据入库', status: 'pending', result: '' },
  { key: 'summary', label: 'AI: 项目概要生成', status: 'pending', result: '' },
  { key: 'anomalies', label: 'AI: 异常检测', status: 'pending', result: '' },
  { key: 'insights', label: 'AI: 洞察发现', status: 'pending', result: '' },
  { key: 'done', label: '分析完成', status: 'pending', result: '' },
]

const AI_STAGE_KEYS = new Set(['summary', 'anomalies', 'insights'])

// ============================================
// 主组件
// ============================================

export default function AnalysisPage() {
  const navigate = useNavigate()
  const { repoPath, repoName } = useProjectStore()
  const aiConfig = useSettingsStore((s) => s.aiConfig)
  const aiVerified = useSettingsStore((s) => s.aiVerified)

  const [stages, setStages] = useState<Stage[]>(() => INITIAL_STAGES.map((s) => ({ ...s })))
  const [streamText, setStreamText] = useState('')
  const [subPercent, setSubPercent] = useState(0)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteValue, setPasteValue] = useState('')
  const runningRef = useRef(false)

  // 更新单个 stage
  const updateStage = useCallback((key: string, updates: Partial<Stage>) => {
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, ...updates } : s)))
  }, [])

  // ============================================
  // 核心分析管线
  // ============================================
  const runPipeline = useCallback(async (rawGitLog?: string) => {
    if (runningRef.current) return
    runningRef.current = true
    setFatalError(null)

    const currentRepoPath = repoPath ?? ''
    const currentRepoName = repoName ?? 'repo'

    try {
      const db = await getDB()

      // —— Stage 1: 获取 Git 日志 ——
      updateStage('git_fetch', { status: 'running' })
      setStreamText('正在读取 Git 仓库日志...')

      let raw: string | undefined = rawGitLog

      if (!raw && isTauri()) {
        // Tauri 环境直接执行 git log
        setStreamText('通过系统命令执行 git log...')
      } else if (!raw) {
        // 浏览器环境 - 需要用户粘贴
        updateStage('git_fetch', { status: 'error', result: '需要手动输入' })
        setPasteMode(true)
        runningRef.current = false
        return
      }

      const commits = await fetchGitCommits(currentRepoPath, raw)

      if (commits.length === 0) {
        updateStage('git_fetch', { status: 'error', result: '未找到提交记录' })
        setFatalError('未找到任何提交记录。请确认仓库路径正确，且仓库有提交历史。')
        runningRef.current = false
        return
      }

      updateStage('git_fetch', { status: 'done', result: `${commits.length} 条记录` })

      // 让 UI 刷新
      await new Promise((r) => setTimeout(r, 0))

      // —— Stage 2: 解析 ——
      updateStage('parse', { status: 'running' })
      setStreamText(`解析 ${commits.length} 条提交记录...`)

      // 让 UI 刷新
      await new Promise((r) => setTimeout(r, 0))

      // 解析已在 fetchGitCommits 内完成，这里直接标记完成
      const uniqueAuthors = new Set(commits.map((c) => c.authorEmail)).size
      updateStage('parse', { status: 'done', result: `${commits.length} 提交, ${uniqueAuthors} 成员` })

      // 让 UI 刷新
      await new Promise((r) => setTimeout(r, 0))

      // —— Stage 3 & 4: 聚合 + 入库 ——
      updateStage('aggregate', { status: 'running' })
      setStreamText('计算统计数据并写入数据库...')

      const ingestResult = await ingestCommits(
        db,
        commits,
        currentRepoPath,
        currentRepoName,
        (p: IngestProgress) => {
          setStreamText(p.message)
          setSubPercent(p.percent)
          // 当进入 meta 阶段时，标记 aggregate 完成，开始 persist
          if (p.stage === 'meta' || p.stage === 'collaboration') {
            updateStage('aggregate', { status: 'done', result: '统计计算完成' })
            updateStage('persist', { status: 'running' })
          }
        },
      )
      setSubPercent(0)

      updateStage('aggregate', { status: 'done', result: '统计计算完成' })
      updateStage('persist', { status: 'done', result: `${ingestResult.durationMs}ms` })

      // 刷新 DB Store
      useDBStore.getState().refresh()

      // —— AI 阶段 ——
      if (aiVerified && aiConfig.apiKey) {
        await runAIStages(updateStage, setStreamText, aiConfig)
      } else {
        // 跳过 AI 阶段
        for (const key of AI_STAGE_KEYS) {
          updateStage(key, { status: 'skipped', result: '未配置 AI' })
        }
        setStreamText('跳过 AI 分析（未配置 AI 服务）')
      }

      // —— 完成 ——
      updateStage('done', { status: 'done', result: '✓ 全部完成' })
      setStreamText('分析完成！即将跳转到仪表盘...')

      // 更新 analysis_meta 状态
      const meta = db.getAnalysisMeta(currentRepoPath)
      if (meta) {
        db.upsertAnalysisMeta({
          repoPath: currentRepoPath,
          repoName: currentRepoName,
          lastAnalyzed: Date.now(),
          totalCommits: meta.total_commits,
          totalAuthors: meta.total_authors,
          status: 'completed',
          durationMs: meta.duration_ms,
        })
        await db.persist()
      }

      useDBStore.getState().refresh()

      // 延迟跳转
      setTimeout(() => navigate('/dashboard'), 1200)
    } catch (err) {
      console.error('[Analysis] Pipeline error:', err)
      setFatalError(err instanceof Error ? err.message : String(err))
    } finally {
      runningRef.current = false
    }
  }, [repoPath, repoName, aiConfig, aiVerified, navigate, updateStage])

  // 自动启动
  useEffect(() => {
    if (!repoPath) {
      navigate('/')
      return
    }
    runPipeline()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 粘贴模式提交
  const handlePasteSubmit = useCallback(() => {
    if (!pasteValue.trim()) return
    setPasteMode(false)
    runPipeline(pasteValue)
  }, [pasteValue, runPipeline])

  // ============================================
  // 进度计算
  // ============================================
  const completedCount = stages.filter((s) => s.status === 'done' || s.status === 'skipped').length
  const progressPercent = Math.round((completedCount / stages.length) * 100)

  const isAiActive = stages.some((s) => AI_STAGE_KEYS.has(s.key) && s.status === 'running')

  function handleSkipAi() {
    for (const key of AI_STAGE_KEYS) {
      updateStage(key, { status: 'skipped', result: '已跳过' })
    }
  }

  // ============================================
  // 渲染
  // ============================================
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background overflow-hidden">
      {/* Decorative blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[380px] h-[380px] rounded-full bg-primary-soft opacity-30 blur-[100px]" />
        <div className="absolute -bottom-32 -left-32 w-[350px] h-[350px] rounded-full bg-secondary-soft opacity-25 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-heading text-2xl text-primary font-bold tracking-tight mb-2">
            GitPulse
          </h1>
          <p className="text-text-secondary text-sm font-body">
            正在分析{' '}
            <span className="font-semibold text-text">
              {repoName || '未知仓库'}
            </span>{' '}
            仓库...
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="h-3.5 rounded-full bg-surface border border-border overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700 ease-out',
                fatalError
                  ? 'bg-danger'
                  : 'bg-gradient-to-r from-primary via-secondary to-accent',
                'relative'
              )}
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
            </div>
          </div>
          <p className="text-xs text-text-muted mt-2 text-right font-mono">
            {Math.round(progressPercent)}%
          </p>
        </div>

        {/* Stage list */}
        <div className="space-y-1 mb-8">
          {stages.map((stage) => {
            const showSubProgress =
              (stage.key === 'aggregate' || stage.key === 'persist') &&
              stage.status === 'running' &&
              subPercent > 0

            return (
              <div key={stage.key}>
                <div
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-[12px] transition-colors duration-200',
                    stage.status === 'running' && 'bg-surface border border-border'
                  )}
                >
                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {stage.status === 'done' && (
                      <CheckCircle2 className="size-5 text-accent" strokeWidth={1.75} />
                    )}
                    {stage.status === 'running' && (
                      <Loader2 className="size-5 text-primary animate-spin" strokeWidth={1.75} />
                    )}
                    {stage.status === 'pending' && (
                      <Circle className="size-5 text-text-muted" strokeWidth={1.75} />
                    )}
                    {stage.status === 'error' && (
                      <XCircle className="size-5 text-danger" strokeWidth={1.75} />
                    )}
                    {stage.status === 'skipped' && (
                      <AlertTriangle className="size-5 text-warning" strokeWidth={1.75} />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      'text-sm flex-1 whitespace-nowrap transition-colors duration-200',
                      stage.status === 'done' && 'text-text',
                      stage.status === 'running' && 'text-text font-medium',
                      stage.status === 'pending' && 'text-text-muted',
                      stage.status === 'error' && 'text-danger',
                      stage.status === 'skipped' && 'text-text-muted',
                    )}
                  >
                    {stage.label}
                  </span>

                  {/* Result */}
                  {(stage.status === 'done' || stage.status === 'error' || stage.status === 'skipped') && stage.result && (
                    <span
                      className={cn(
                        'text-xs font-mono shrink-0',
                        stage.status === 'error' ? 'text-danger max-w-[280px] truncate' : 'text-text-muted truncate max-w-[180px]'
                      )}
                      title={stage.status === 'error' ? stage.result : undefined}
                    >
                      {stage.result}
                    </span>
                  )}

                  {/* Sub percent for running stages */}
                  {showSubProgress && (
                    <span className="text-xs text-primary font-mono">{subPercent}%</span>
                  )}
                </div>

                {/* Sub progress bar */}
                {showSubProgress && (
                  <div className="mx-4 mt-1 mb-1">
                    <div className="h-1 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                        style={{ width: `${subPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Paste mode (browser fallback) */}
        {pasteMode && (
          <div className="bg-surface rounded-[16px] border border-border p-5 mb-6">
            <p className="text-sm text-text-secondary mb-2">
              浏览器环境无法直接读取 Git 仓库。请在终端运行以下命令，然后粘贴输出：
            </p>
            <div className="bg-background rounded-[10px] border border-border p-3 mb-4 overflow-x-auto">
              <code className="text-xs text-primary font-mono whitespace-pre-wrap break-all select-all">
                {getGitLogCommand(repoPath ?? undefined)}
              </code>
            </div>
            <textarea
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder="粘贴 git log 输出到这里..."
              className={cn(
                'w-full h-32 rounded-[10px] border border-border bg-background',
                'px-3 py-2 text-xs font-mono text-text',
                'placeholder:text-text-muted resize-none',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-border-focus'
              )}
            />
            <button
              onClick={handlePasteSubmit}
              disabled={!pasteValue.trim()}
              className={cn(
                'mt-3 w-full py-2.5 rounded-[12px] text-sm font-semibold',
                'bg-primary text-primary-foreground cursor-pointer',
                'hover:opacity-90 transition-opacity',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              开始分析
            </button>
          </div>
        )}

        {/* Stream text area */}
        {!pasteMode && (
          <div className="bg-surface rounded-[16px] border border-border p-4 mb-6 min-h-[80px]">
            <p className="text-xs text-text-muted mb-2 font-mono">Terminal</p>
            <p className="text-sm text-text-secondary font-mono leading-relaxed">
              {streamText}
              {!fatalError && progressPercent < 100 && (
                <span className="inline-block w-[2px] h-[14px] bg-primary ml-0.5 align-middle animate-pulse" />
              )}
            </p>
          </div>
        )}

        {/* Fatal error */}
        {fatalError && (
          <div className="rounded-[14px] border border-danger/30 bg-danger/5 px-4 py-3 mb-6">
            <p className="text-sm text-danger font-medium mb-1">分析出错</p>
            <p className="text-xs text-danger/80">{fatalError}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 text-xs rounded-[10px] bg-surface border border-border text-text-secondary hover:bg-surface-hover cursor-pointer"
              >
                返回首页
              </button>
              <button
                onClick={() => {
                  setFatalError(null)
                  setStages(INITIAL_STAGES.map((s) => ({ ...s })))
                  runPipeline()
                }}
                className="px-4 py-2 text-xs rounded-[10px] bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
              >
                重试
              </button>
            </div>
          </div>
        )}

        {/* Skip AI button */}
        {isAiActive && !fatalError && (
          <div className="text-center">
            <button
              onClick={handleSkipAi}
              className={cn(
                'px-4 py-2 text-sm text-text-muted cursor-pointer',
                'rounded-[10px] transition-colors duration-200',
                'hover:text-text hover:bg-surface-hover',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus'
              )}
            >
              跳过 AI 分析
            </button>
          </div>
        )}
      </div>

      {/* Shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

// ============================================
// AI 分析阶段
// ============================================

async function runAIStages(
  updateStage: (key: string, updates: Partial<Stage>) => void,
  setStreamText: (text: string) => void,
  aiConfig: AIConfig,
) {
  // Summary
  updateStage('summary', { status: 'running' })
  setStreamText('AI 正在生成项目概要...')
  try {
    const { getDashboardSummary } = await import('@/ai/tasks/dashboard-summary')
    const result = await getDashboardSummary(aiConfig)
    if (result?.summary) {
      updateStage('summary', { status: 'done', result: `✓ ${result.summary.slice(0, 40)}...` })

      // 保存到 AI results
      const db = await getDB()
      db.saveAIResult({
        id: `summary_${Date.now()}`,
        type: 'project_summary',
        target: null,
        resultJson: JSON.stringify({ summary: result.summary, highlights: result.highlights }),
        model: aiConfig.model,
        tokenUsed: 0,
        createdAt: Date.now(),
        expiresAt: null,
      })
    } else {
      updateStage('summary', { status: 'error', result: 'AI 未返回有效数据' })
    }
  } catch (err) {
    console.warn('[Analysis] AI summary failed:', err)
    const aiErr = handleAIError(err)
    updateStage('summary', { status: 'error', result: aiErr.message })
  }

  // Anomalies
  updateStage('anomalies', { status: 'running' })
  setStreamText('AI 正在检测异常模式...')
  try {
    const { getAnomalyReport } = await import('@/ai/tasks/anomaly-detection')
    const result = await getAnomalyReport(aiConfig)
    if (result?.anomalies) {
      updateStage('anomalies', { status: 'done', result: `${result.anomalies.length} 项发现` })
    } else {
      updateStage('anomalies', { status: 'error', result: 'AI 未返回有效数据' })
    }
  } catch (err) {
    console.warn('[Analysis] AI anomalies failed:', err)
    const aiErr = handleAIError(err)
    updateStage('anomalies', { status: 'error', result: aiErr.message })
  }

  // Insights
  updateStage('insights', { status: 'running' })
  setStreamText('AI 正在挖掘团队洞察...')
  try {
    const { getTeamInsights } = await import('@/ai/tasks/team-insights')
    const result = await getTeamInsights(aiConfig)
    if (result?.insights) {
      updateStage('insights', { status: 'done', result: `${result.insights.length} 条洞察` })

      // 保存到 AI results
      const db = await getDB()
      db.saveAIResult({
        id: `insights_${Date.now()}`,
        type: 'insights',
        target: null,
        resultJson: JSON.stringify({ insights: result.insights, teamHealthScore: result.teamHealthScore }),
        model: aiConfig.model,
        tokenUsed: 0,
        createdAt: Date.now(),
        expiresAt: null,
      })
    } else {
      updateStage('insights', { status: 'error', result: 'AI 未返回有效数据' })
    }
  } catch (err) {
    console.warn('[Analysis] AI insights failed:', err)
    const aiErr = handleAIError(err)
    updateStage('insights', { status: 'error', result: aiErr.message })
  }
}
