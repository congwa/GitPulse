import { useCallback, useMemo } from 'react'
import { FolderTree, Sparkles } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import { cn } from '@/lib/utils'
import { CHART_HEX_COLORS } from '@/lib/chart-colors'
import { useDBStore } from '@/stores/db-store'
import { useSettingsStore } from '@/stores/settings'
import { useAITask } from '@/hooks/useAITask'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { AIInsightCard } from '@/components/ui/ai-insight-card'

/* ─── page ─── */

export default function ModulesPage() {
  const { modules, authorStats } = useDBStore()
  const apiKey = useSettingsStore((s) => s.aiConfig.apiKey)

  // AI Anomaly Report (bus factor 对模块尤为重要)
  const getAnomalyFn = useCallback(
    async (config: Parameters<typeof import("@/ai/tasks/anomaly-detection").getAnomalyReport>[0]) => {
      const { getAnomalyReport } = await import("@/ai/tasks/anomaly-detection")
      return getAnomalyReport(config)
    },
    []
  )
  const [anomalyState, anomalyActions] = useAITask(getAnomalyFn, "anomaly_report")

  /* ─── helpers ─── */

  const ownerColor = useCallback((ownerEmail: string): string => {
    const idx = authorStats.findIndex((a) => a.email === ownerEmail)
    return CHART_HEX_COLORS[idx >= 0 ? idx : 0]
  }, [authorStats])

  /* ─── treemap option ─── */

  const treemapOption = useMemo(() => ({
    tooltip: {
      formatter: (p: { name: string; value: number; data: { owner: string } }) =>
        `<strong>${p.name}</strong><br/>提交: ${p.value}<br/>负责人: ${p.data.owner}`,
    },
    series: [
      {
        type: 'treemap' as const,
        roam: false,
        width: '100%',
        height: '100%',
        breadcrumb: { show: false },
        label: {
          show: true,
          formatter: '{b}',
          fontSize: 13,
          color: '#fff',
          fontWeight: 'bold' as const,
        },
        itemStyle: { borderWidth: 3, borderColor: 'var(--surface)', gapWidth: 2 },
        data: modules.map((m) => ({
          name: m.directory,
          value: m.totalCommits,
          owner: m.ownerName,
          itemStyle: { color: ownerColor(m.ownerEmail) },
        })),
      },
    ],
  }), [modules, ownerColor])

  if (modules.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader icon={<FolderTree className="h-5 w-5" strokeWidth={1.75} />} title="模块分析" />
        <EmptyState title="暂无模块数据" description="请先在首页选择仓库完成分析" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<FolderTree className="h-5 w-5" strokeWidth={1.75} />}
        title="模块分析"
      />

      {/* Treemap */}
      <div className="bg-surface rounded-[20px] border border-border p-5">
        <h2 className="mb-4 font-heading text-sm font-semibold text-text">模块归属地图</h2>
        <ReactECharts option={treemapOption} style={{ height: 340 }} />
      </div>

      {/* Module Detail Table */}
      <div className="bg-surface rounded-[20px] border border-border p-5">
        <h2 className="mb-4 font-heading text-sm font-semibold text-text">模块详情</h2>

        {/* Header */}
        <div className="mb-2 grid grid-cols-[1fr_72px_72px_140px_100px] gap-3 px-4 text-xs font-semibold text-text-muted">
          <span>目录</span>
          <span className="text-right">文件</span>
          <span className="text-right">提交</span>
          <span>负责人</span>
          <span>热度</span>
        </div>

        {/* Rows */}
        <div className="flex flex-col gap-2">
          {modules.map((m) => (
            <div
              key={m.directory}
              className={cn(
                'grid grid-cols-[1fr_72px_72px_140px_100px] items-center gap-3 px-4 py-3',
                'bg-surface rounded-[12px] border border-border',
                'transition-colors duration-150 hover:bg-surface-hover'
              )}
            >
              {/* Dir */}
              <span className="truncate font-mono text-sm text-text">{m.directory}</span>

              {/* Files */}
              <span className="text-right text-sm text-text-secondary">{m.totalFiles}</span>

              {/* Commits */}
              <span className="text-right font-mono text-sm text-text">{m.totalCommits}</span>

              {/* Owner */}
              <span className="flex items-center gap-2 text-sm text-text-secondary">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: ownerColor(m.ownerEmail) }}
                />
                <span className="truncate">{m.ownerName}</span>
              </span>

              {/* Heat bar */}
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${m.heat}%`,
                      backgroundColor: ownerColor(m.ownerEmail),
                    }}
                  />
                </div>
                <span className="w-8 text-right text-xs text-text-muted">{m.heat}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insight */}
      <AIInsightCard
        icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
        title="AI 模块洞察"
        loading={anomalyState.loading}
        error={anomalyState.error?.message}
        onRefresh={() => anomalyActions.run()}
        noApiKey={!apiKey}
      >
        {anomalyState.data ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-text-muted">整体风险</span>
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                anomalyState.data.overallRisk === 'high' ? 'bg-danger/10 text-danger' :
                anomalyState.data.overallRisk === 'medium' ? 'bg-warning/10 text-warning' :
                'bg-accent/10 text-accent'
              )}>
                {anomalyState.data.overallRisk === 'none' ? '无风险' : anomalyState.data.overallRisk}
              </span>
            </div>
            {anomalyState.data.anomalies.map((a, i) => (
              <div key={i} className="rounded-[8px] bg-surface-hover p-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'inline-block h-2 w-2 rounded-full',
                    a.severity === 'high' ? 'bg-danger' :
                    a.severity === 'medium' ? 'bg-warning' : 'bg-accent'
                  )} />
                  <p className="text-xs font-semibold text-text">{a.title}</p>
                </div>
                <p className="mt-1 text-xs text-text-secondary">{a.description}</p>
                <p className="mt-1 text-xs text-primary">建议: {a.suggestion}</p>
              </div>
            ))}
          </div>
        ) : null}
      </AIInsightCard>
    </div>
  )
}
