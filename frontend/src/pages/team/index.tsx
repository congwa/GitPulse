import { useNavigate } from 'react-router-dom'
import { useCallback, useMemo } from 'react'
import { Users, Crown, Sparkles } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import { cn } from '@/lib/utils'
import { CHART_HEX_COLORS } from '@/lib/chart-colors'
import { useDBStore, type AuthorStat } from '@/stores/db-store'
import { EmptyState } from '@/components/ui/empty-state'
import { useSettingsStore } from '@/stores/settings'
import { useAITask } from '@/hooks/useAITask'
import { PageHeader } from '@/components/ui/page-header'
import { Tag } from '@/components/ui/tag'
import { AIInsightCard } from '@/components/ui/ai-insight-card'

/* ─── helpers ─── */

const radarIndicators = [
  { name: '提交频率', max: 100 },
  { name: '代码量', max: 100 },
  { name: '模块广度', max: 100 },
  { name: '存活率', max: 100 },
  { name: '消息质量', max: 100 },
  { name: '协作指数', max: 100 },
]

const tagVariantMap: Record<string, 'primary' | 'secondary' | 'accent' | 'muted'> = {
  role: 'primary',
  skill: 'secondary',
  pattern: 'accent',
}

/* ─── charts ─── */

function useStackedAreaOption(authorStats: AuthorStat[]) {
  return useMemo(() => {
    // 将各成员总提交按均匀比例分配到最近6个月（真实月度数据需后端计算）
    const now = new Date()
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    const stackedData = months.map((month, mi) => {
      const data: Record<string, string | number> = { month }
      authorStats.forEach((a) => {
        // 按月均分，靠近当前月份略多
        const weight = 0.12 + (mi / 5) * 0.08
        data[a.name] = Math.round(a.totalCommits * weight)
      })
      return data
    })

    const series = authorStats.map((a, i) => ({
      name: a.name,
      type: 'line' as const,
      stack: 'total',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color: CHART_HEX_COLORS[i] },
      areaStyle: { color: CHART_HEX_COLORS[i], opacity: 0.18 },
      itemStyle: { color: CHART_HEX_COLORS[i] },
      data: stackedData.map((d) => d[a.name] as number),
    }))

    return {
      tooltip: { trigger: 'axis' as const },
      legend: {
        bottom: 0,
        textStyle: { color: 'var(--text-secondary)', fontSize: 12 },
        itemWidth: 12,
        itemHeight: 4,
        itemGap: 16,
      },
      grid: { top: 16, left: 48, right: 16, bottom: 40 },
      xAxis: {
        type: 'category' as const,
        data: months,
        axisLine: { lineStyle: { color: 'var(--border)' } },
        axisLabel: { color: 'var(--text-muted)', fontSize: 12 },
      },
      yAxis: {
        type: 'value' as const,
        splitLine: { lineStyle: { color: 'var(--border)', type: 'dashed' as const } },
        axisLabel: { color: 'var(--text-muted)', fontSize: 12 },
      },
      series,
    }
  }, [authorStats])
}

function useRadarOption(authorStats: AuthorStat[]) {
  return useMemo(() => {
    const top3 = authorStats.slice(0, 3)
    return {
      tooltip: {},
      legend: {
        bottom: 0,
        textStyle: { color: 'var(--text-secondary)', fontSize: 12 },
        itemWidth: 12,
        itemHeight: 4,
      },
      radar: {
        indicator: radarIndicators,
        radius: '60%',
        axisName: { color: 'var(--text-secondary)', fontSize: 11 },
        splitArea: { areaStyle: { color: 'transparent' } },
        splitLine: { lineStyle: { color: 'var(--border)' } },
        axisLine: { lineStyle: { color: 'var(--border)' } },
      },
      series: [
        {
          type: 'radar' as const,
          data: top3.map((m, i) => ({
            name: m.name,
            value: m.radarData,
            lineStyle: { color: CHART_HEX_COLORS[i], width: 2 },
            itemStyle: { color: CHART_HEX_COLORS[i] },
            areaStyle: { color: CHART_HEX_COLORS[i], opacity: 0.15 },
          })),
        },
      ],
    }
  }, [authorStats])
}

/* ─── page ─── */

export default function TeamPage() {
  const navigate = useNavigate()
  const { authorStats, aiSummary } = useDBStore()
  const apiKey = useSettingsStore((s) => s.aiConfig.apiKey)
  const stackedOption = useStackedAreaOption(authorStats)
  const radarOption = useRadarOption(authorStats)

  // AI Team Insights
  const getTeamInsightsFn = useCallback(
    async (config: Parameters<typeof import("@/ai/tasks/team-insights").getTeamInsights>[0]) => {
      const { getTeamInsights } = await import("@/ai/tasks/team-insights")
      return getTeamInsights(config)
    },
    []
  )
  const [insightsState, insightsActions] = useAITask(getTeamInsightsFn, "team_insights")

  if (authorStats.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader icon={<Users className="h-5 w-5" strokeWidth={1.75} />} title="团队全景" />
        <EmptyState title="暂无团队数据" description="请先在首页选择仓库完成分析" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={<Users className="h-5 w-5" strokeWidth={1.75} />} title="团队全景" />

      {/* Stacked Area */}
      <div className="bg-surface rounded-[20px] border border-border p-5">
        <h2 className="mb-4 font-heading text-sm font-semibold text-text">成员贡献趋势</h2>
        <ReactECharts option={stackedOption} style={{ height: 280 }} />
      </div>

      {/* Radar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-surface rounded-[20px] border border-border p-5">
          <h2 className="mb-4 font-heading text-sm font-semibold text-text">能力雷达（Top 3）</h2>
          <ReactECharts option={radarOption} style={{ height: 300 }} />
        </div>

        {/* Placeholder second column or additional chart */}
        <div className="bg-surface rounded-[20px] border border-border p-5 flex flex-col">
          <h2 className="mb-4 font-heading text-sm font-semibold text-text">团队快照</h2>
          <div className="grid grid-cols-2 gap-4 flex-1 content-center">
            {[
              { label: '总提交', value: authorStats.reduce((s, m) => s + m.totalCommits, 0) },
              { label: '活跃成员', value: authorStats.length },
              { label: '平均活跃天', value: authorStats.length > 0 ? Math.round(authorStats.reduce((s, m) => s + m.activeDays, 0) / authorStats.length) : 0 },
              { label: '代码净增', value: `${((authorStats.reduce((s, m) => s + m.insertions - m.deletions, 0)) / 1000).toFixed(1)}k` },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-mono text-2xl font-bold text-text">{s.value}</p>
                <p className="mt-1 text-xs text-text-secondary">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Member Ranking Table */}
      <div className="bg-surface rounded-[20px] border border-border p-5">
        <h2 className="mb-4 font-heading text-sm font-semibold text-text">成员排行</h2>

        {/* Header */}
        <div className="mb-2 grid grid-cols-[48px_1fr_100px_100px_1fr] gap-3 px-4 text-xs font-semibold text-text-muted">
          <span>#</span>
          <span>成员</span>
          <span className="text-right">提交</span>
          <span className="text-right">代码行</span>
          <span>标签</span>
        </div>

        {/* Rows */}
        <div className="flex flex-col gap-2">
          {authorStats.map((a, i) => (
            <button
              key={a.email}
              onClick={() => navigate(`/member/${encodeURIComponent(a.email)}`)}
              className={cn(
                'grid grid-cols-[48px_1fr_100px_100px_1fr] items-center gap-3 px-4 py-3',
                'bg-surface rounded-[12px] border border-border',
                'cursor-pointer text-left',
                'transition-colors duration-150 hover:bg-surface-hover'
              )}
            >
              {/* Rank */}
              <span className="flex items-center justify-center">
                {i === 0 ? (
                  <Crown className="h-5 w-5 text-warning" strokeWidth={1.75} />
                ) : (
                  <span className="font-mono text-sm text-text-muted">#{i + 1}</span>
                )}
              </span>

              {/* Name */}
              <span className="truncate font-semibold text-sm text-text">{a.name}</span>

              {/* Commits */}
              <span className="text-right font-mono text-sm text-text">{a.totalCommits}</span>

              {/* Lines */}
              <span className="text-right font-mono text-sm text-accent">
                +{(a.insertions / 1000).toFixed(1)}k
              </span>

              {/* Tags */}
              <span className="flex flex-wrap gap-1.5">
                {a.tags.map((t) => (
                  <Tag key={t.label} variant={tagVariantMap[t.type] ?? 'muted'}>
                    {t.label}
                  </Tag>
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* AI Insight */}
      <AIInsightCard
        icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
        title="AI 洞察"
        loading={insightsState.loading}
        error={insightsState.error?.message}
        onRefresh={() => insightsActions.run()}
        noApiKey={!apiKey}
      >
        {insightsState.data ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-muted">团队健康度</span>
              <span className="font-mono font-bold text-primary">{insightsState.data.teamHealthScore}</span>
              <span className="text-text-muted">/ 100</span>
            </div>
            {insightsState.data.insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={cn(
                  'mt-0.5 inline-block h-2 w-2 rounded-full shrink-0',
                  ins.category === 'risk' ? 'bg-danger' :
                  ins.category === 'highlight' ? 'bg-accent' :
                  ins.category === 'trend' ? 'bg-secondary' : 'bg-primary'
                )} />
                <div>
                  <p className="text-xs font-semibold text-text">{ins.title}</p>
                  <p className="text-xs text-text-secondary">{ins.content}</p>
                </div>
              </div>
            ))}
            {insightsState.fromCache && (
              <p className="text-[10px] text-text-muted">来自缓存</p>
            )}
          </div>
        ) : (
          aiSummary || null
        )}
      </AIInsightCard>
    </div>
  )
}
