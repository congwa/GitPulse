import { useMemo, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, GitCommit, Code, Clock, FileCode } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import { cn } from '@/lib/utils'
import { CHART_HEX_COLORS } from '@/lib/chart-colors'
import { useDBStore } from '@/stores/db-store'
import { getDBSync } from '@/lib/database'
import { useSettingsStore } from '@/stores/settings'
import { StatCard } from '@/components/ui/stat-card'
import { Tag } from '@/components/ui/tag'
import { AIInsightCard } from '@/components/ui/ai-insight-card'

/* ─── constants ─── */

const tagVariantMap: Record<string, 'primary' | 'secondary' | 'accent' | 'muted'> = {
  role: 'primary',
  skill: 'secondary',
  pattern: 'accent',
}

const commitTypeColor: Record<string, string> = {
  feat: 'var(--primary)',
  fix: 'var(--danger)',
  refactor: 'var(--secondary)',
  docs: 'var(--accent)',
  chore: 'var(--text-muted)',
}

const heatmapLevels = [
  'var(--border)',        // 0
  'var(--primary-soft)',  // 1–2
  'var(--primary)',       // 3–4
  'var(--secondary)',     // 5–6
  'var(--accent)',        // 7+
]

function heatColor(count: number): string {
  if (count === 0) return heatmapLevels[0]
  if (count <= 2) return heatmapLevels[1]
  if (count <= 4) return heatmapLevels[2]
  if (count <= 6) return heatmapLevels[3]
  return heatmapLevels[4]
}

/* ─── page ─── */

export default function MemberPage() {
  const { email } = useParams<{ email: string }>()
  const navigate = useNavigate()

  const { authorStats } = useDBStore()
  const getAuthorByEmail = useDBStore((s) => s.getAuthorByEmail)
  const getPersonalCommits = useDBStore((s) => s.getPersonalCommits)
  const getPortrait = useDBStore((s) => s.getPortrait)

  const getAuthorHeatmap = useDBStore((s) => s.getAuthorHeatmap)

  const member = getAuthorByEmail(email!)
  const memberIdx = authorStats.findIndex((a) => a.email === email)
  const chartColor = CHART_HEX_COLORS[memberIdx >= 0 ? memberIdx : 0]

  // 从 DB 获取 7×24 热力图，转换为 365 天日历热力图
  const heatmapData = useMemo(() => {
    const rawHeatmap = email ? getAuthorHeatmap(email) : []
    // 创建 day-of-week × hour-of-day → value 查找表
    const lookup = new Map<string, number>()
    rawHeatmap.forEach((c) => lookup.set(`${c.day}-${c.hour}`, c.value))

    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 364)

    return Array.from({ length: 365 }, (_, i) => {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dayOfWeek = date.getDay()
      const hour = 12 // 中位时间
      const count = lookup.get(`${dayOfWeek}-${hour}`) ?? 0
      return {
        date: date.toISOString().slice(0, 10),
        count,
      }
    })
  }, [email, getAuthorHeatmap])

  // Group heatmap by week for 52-week grid
  const weeks = useMemo(() => {
    const result: typeof heatmapData[number][][] = []
    let week: typeof heatmapData[number][] = []
    heatmapData.forEach((d, i) => {
      const dayOfWeek = new Date(d.date).getDay()
      if (i > 0 && dayOfWeek === 0 && week.length > 0) {
        result.push(week)
        week = []
      }
      week.push(d)
    })
    if (week.length > 0) result.push(week)
    return result.slice(-52) // last 52 weeks
  }, [heatmapData])

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-text-secondary">
        <p className="text-lg">未找到该成员</p>
        <button
          onClick={() => navigate('/team')}
          className="mt-4 text-primary hover:underline cursor-pointer"
        >
          返回团队页
        </button>
      </div>
    )
  }

  // Donut option - 使用 useMemo 避免每次渲染重算
  const donutOption = useMemo(() => ({
    tooltip: { trigger: 'item' as const },
    legend: {
      bottom: 0,
      textStyle: { color: 'var(--text-secondary)', fontSize: 12 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        type: 'pie' as const,
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: { show: false },
        data: Object.entries(member.commitTypes).map(([name, value], i) => ({
          name,
          value,
          itemStyle: { color: CHART_HEX_COLORS[i] },
        })),
      },
    ],
  }), [member.commitTypes])

  // 模块柱状图 — 从 DB 查询该成员在各模块的真实提交数
  const moduleCommits = useMemo(() => {
    const db = getDBSync()
    if (!db || !email) return member.topDirs.map((_, i) => Math.max(1, member.topDirs.length - i))
    try {
      return member.topDirs.map((dir) => {
        const row = db.queryOne<{ cnt: number }>(
          "SELECT SUM(commits) as cnt FROM stats_module_ownership WHERE author_email = ? AND directory = ?",
          [email, dir]
        )
        return row?.cnt ?? 0
      })
    } catch {
      return member.topDirs.map((_, i) => Math.max(1, member.topDirs.length - i))
    }
  }, [email, member.topDirs])

  const barOption = useMemo(() => ({
    tooltip: {},
    grid: { top: 8, left: 100, right: 24, bottom: 8 },
    xAxis: {
      type: 'value' as const,
      show: false,
    },
    yAxis: {
      type: 'category' as const,
      data: [...member.topDirs].reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' },
    },
    series: [
      {
        type: 'bar' as const,
        data: [...moduleCommits].reverse(),
        barWidth: 14,
        itemStyle: {
          color: chartColor,
          borderRadius: [0, 6, 6, 0],
        },
      },
    ],
  }), [member.topDirs, moduleCommits, chartColor])

  // 使用 useMemo 缓存 getPersonalCommits 和 getPortrait 的结果，避免渲染时触发 DB 查询
  const memberCommits = useMemo(() => getPersonalCommits(email!), [email, getPersonalCommits])
  const portrait = useMemo(() => getPortrait(email!), [email, getPortrait])
  const apiKey = useSettingsStore((s) => s.aiConfig.apiKey)

  // AI portrait streaming
  const [aiPortrait, setAiPortrait] = useState<string | null>(null)
  const [aiPortraitLoading, setAiPortraitLoading] = useState(false)
  const [aiPortraitError, setAiPortraitError] = useState<string | null>(null)

  const handleGeneratePortrait = useCallback(async () => {
    if (!email || aiPortraitLoading) return
    setAiPortraitLoading(true)
    setAiPortraitError(null)
    setAiPortrait(null)

    try {
      const config = useSettingsStore.getState().aiConfig
      const { streamMemberPortrait } = await import('@/ai/tasks/member-portrait')
      let content = ''
      for await (const chunk of streamMemberPortrait(config, email)) {
        if (chunk.type === 'text' && chunk.content) {
          content = chunk.content
          setAiPortrait(content)
        }
      }
    } catch (err) {
      try {
        const { handleAIError } = await import('@/ai/error-handler')
        setAiPortraitError(handleAIError(err).message)
      } catch {
        setAiPortraitError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setAiPortraitLoading(false)
    }
  }, [email, aiPortraitLoading])

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/team')}
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        返回团队
      </button>

      {/* Profile Header */}
      <div
        className="rounded-[20px] border border-border p-6 md:p-8"
        style={{
          background: `linear-gradient(135deg, var(--primary-soft) 0%, var(--surface) 60%)`,
        }}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* Avatar */}
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white"
            style={{ backgroundColor: chartColor }}
          >
            {member.name.charAt(0)}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="font-heading text-2xl font-bold text-text">{member.name}</h1>
            <p className="mt-0.5 text-sm text-text-muted">{member.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {member.tags.map((t) => (
                <Tag key={t.label} variant={tagVariantMap[t.type] ?? 'muted'}>
                  {t.label}
                </Tag>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-secondary">
              首次: {member.firstCommit} | 提交: {member.totalCommits} | 活跃: {member.activeDays}天
            </p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<GitCommit className="h-5 w-5" strokeWidth={1.75} />}
          label="日均提交"
          value={(member.totalCommits / member.activeDays).toFixed(1)}
        />
        <StatCard
          icon={<Code className="h-5 w-5" strokeWidth={1.75} />}
          label="代码净增"
          value={`+${((member.insertions - member.deletions) / 1000).toFixed(1)}k`}
        />
        <StatCard
          icon={<FileCode className="h-5 w-5" strokeWidth={1.75} />}
          label="涉及文件"
          value={String(member.filesTouched)}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" strokeWidth={1.75} />}
          label="平均提交"
          value={`${member.avgCommitSize.toFixed(0)} 行`}
        />
      </div>

      {/* 52-week Heatmap */}
      <div className="bg-surface rounded-[20px] border border-border p-5">
        <h2 className="mb-4 font-heading text-sm font-semibold text-text">52 周贡献热力图</h2>
        <div className="overflow-x-auto">
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day) => (
                  <div
                    key={day.date}
                    className="h-[13px] w-[13px] rounded-[3px] transition-colors"
                    style={{ backgroundColor: heatColor(day.count) }}
                    title={`${day.date}: ${day.count} commits`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Legend */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-text-muted">
          <span>少</span>
          {heatmapLevels.map((c, i) => (
            <div
              key={i}
              className="h-[13px] w-[13px] rounded-[3px]"
              style={{ backgroundColor: c }}
            />
          ))}
          <span>多</span>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Commit type donut */}
        <div className="bg-surface rounded-[20px] border border-border p-5">
          <h2 className="mb-4 font-heading text-sm font-semibold text-text">提交类型分布</h2>
          <ReactECharts option={donutOption} style={{ height: 260 }} />
        </div>

        {/* Module bar */}
        <div className="bg-surface rounded-[20px] border border-border p-5">
          <h2 className="mb-4 font-heading text-sm font-semibold text-text">活跃模块</h2>
          <ReactECharts option={barOption} style={{ height: 260 }} />
        </div>
      </div>

      {/* Recent Commits Timeline */}
      <div className="bg-surface rounded-[20px] border border-border p-5">
        <h2 className="mb-4 font-heading text-sm font-semibold text-text">最近提交</h2>
        <div className="relative ml-3 border-l-2 border-border pl-6 space-y-5">
          {memberCommits.map((c) => (
            <div key={c.hash} className="relative">
              {/* Dot */}
              <div
                className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-surface"
                style={{ backgroundColor: commitTypeColor[c.commitType] ?? 'var(--text-muted)' }}
              />
              <p className="text-sm text-text">{c.message}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                <span>{new Date(c.timestamp * 1000).toLocaleString()}</span>
                <code className="font-mono text-text-secondary">{c.hash}</code>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Portrait */}
      <AIInsightCard
        variant="portrait"
        title={`${member.name} 的 AI 画像`}
        loading={aiPortraitLoading}
        error={aiPortraitError}
        onRefresh={handleGeneratePortrait}
        noApiKey={!apiKey}
      >
        {aiPortrait ? (
          <div className="whitespace-pre-wrap">{aiPortrait}</div>
        ) : portrait ? (
          portrait
        ) : null}
      </AIInsightCard>
    </div>
  )
}
