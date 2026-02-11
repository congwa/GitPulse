import { useState, useMemo, useCallback } from "react"
import ReactECharts from "echarts-for-react"
import {
  LayoutDashboard,
  GitCommit,
  Users,
  FileCode2,
  Code2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { TimeRangeSelector } from "@/components/ui/time-range-selector"
import { AIInsightCard } from "@/components/ui/ai-insight-card"
import { useDBStore } from "@/stores/db-store"
import { useSettingsStore } from "@/stores/settings"
import { useAITask } from "@/hooks/useAITask"
import { EmptyState } from "@/components/ui/empty-state"
import { CHART_HEX_COLORS } from "@/lib/chart-colors"

// ── Chart helpers ──────────────────────────────────────────────────
const PRIMARY_HEX = "#FF8C6B"

function useCommitTrendOption(weeklyCommits: { week: string; commits: number }[]) {
  return useMemo(
    () => ({
      tooltip: {
        trigger: "axis" as const,
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        textStyle: { color: "var(--text)", fontSize: 12 },
      },
      grid: { top: 16, right: 12, bottom: 28, left: 40 },
      xAxis: {
        type: "category" as const,
        data: weeklyCommits.map((d) => d.week),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "var(--text-muted)",
          fontSize: 11,
          fontFamily: "var(--font-mono)",
        },
      },
      yAxis: {
        type: "value" as const,
        splitLine: { lineStyle: { color: "var(--border)", type: "dashed" as const } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "var(--text-muted)",
          fontSize: 11,
          fontFamily: "var(--font-mono)",
        },
      },
      series: [
        {
          type: "line",
          data: weeklyCommits.map((d) => d.commits),
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          showSymbol: false,
          lineStyle: { color: PRIMARY_HEX, width: 2.5 },
          itemStyle: { color: PRIMARY_HEX },
          areaStyle: {
            color: {
              type: "linear" as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(255,140,107,0.25)" },
                { offset: 1, color: "rgba(255,140,107,0.02)" },
              ],
            },
          },
          emphasis: {
            focus: "series" as const,
            itemStyle: {
              color: PRIMARY_HEX,
              borderColor: "#fff",
              borderWidth: 2,
              shadowBlur: 8,
              shadowColor: "rgba(255,140,107,0.4)",
            },
          },
        },
      ],
    }),
    [weeklyCommits]
  )
}

function useCommitTypesOption(commitTypes: { name: string; value: number }[]) {
  const total = commitTypes.reduce((s, d) => s + d.value, 0)

  return useMemo(
    () => ({
      tooltip: {
        trigger: "item" as const,
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        textStyle: { color: "var(--text)", fontSize: 12 },
        formatter: (params: { name: string; value: number; percent: number }) =>
          `${params.name}: ${params.value} (${params.percent}%)`,
      },
      legend: { show: false },
      series: [
        {
          type: "pie",
          radius: ["55%", "75%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 6, borderColor: "var(--surface)", borderWidth: 2 },
          label: {
            show: true,
            position: "center" as const,
            formatter: () => `{total|${total}}\n{label|commits}`,
            rich: {
              total: {
                fontSize: 22,
                fontWeight: "bold" as const,
                fontFamily: "var(--font-mono)",
                color: "var(--text)",
                lineHeight: 30,
              },
              label: {
                fontSize: 11,
                color: "var(--text-muted)",
                lineHeight: 16,
              },
            },
          },
          emphasis: {
            label: { show: true },
            scaleSize: 6,
          },
          data: commitTypes.map((d, i) => ({
            value: d.value,
            name: d.name,
            itemStyle: { color: CHART_HEX_COLORS[i] },
          })),
        },
      ],
    }),
    [commitTypes, total]
  )
}

function useHeatmapOption(teamHeatmap: { hour: number; day: number; value: number }[]) {
  const allHours = Array.from({ length: 24 }, (_, i) => String(i))
  const labelHours = new Set(["0", "3", "6", "9", "12", "15", "18", "21"])
  const days = ["日", "一", "二", "三", "四", "五", "六"]
  const maxVal = Math.max(...teamHeatmap.map((d) => d.value), 0)

  return useMemo(
    () => ({
      tooltip: {
        position: "top" as const,
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        textStyle: { color: "var(--text)", fontSize: 12 },
        formatter: (params: { value: [number, number, number] }) => {
          const [hour, day, val] = params.value
          return `周${days[day]} ${hour}:00 — ${val} 次提交`
        },
      },
      grid: { top: 8, right: 12, bottom: 36, left: 36 },
      xAxis: {
        type: "category" as const,
        data: allHours,
        splitArea: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "var(--text-muted)",
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          formatter: (val: string) => (labelHours.has(val) ? val : ""),
          interval: 0,
        },
      },
      yAxis: {
        type: "category" as const,
        data: days,
        splitArea: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "var(--text-muted)",
          fontSize: 11,
        },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        calculable: false,
        show: false,
        inRange: {
          color: ["#FFF1E8", "#FFDAC8", "#FFB899", "#FF8C6B"],
        },
      },
      series: [
        {
          type: "heatmap",
          data: teamHeatmap.map((d) => [d.hour, d.day, d.value]),
          label: { show: false },
          itemStyle: {
            borderRadius: 4,
            borderColor: "var(--surface)",
            borderWidth: 2,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: "rgba(255,140,107,0.35)",
            },
          },
        },
      ],
    }),
    [teamHeatmap, maxVal]
  )
}

// ── Card wrapper ───────────────────────────────────────────────────
function ChartCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-border bg-surface p-5",
        "shadow-[var(--shadow-card)]",
        className
      )}
    >
      <h3 className="mb-3 font-heading text-sm font-semibold text-text">
        {title}
      </h3>
      {children}
    </div>
  )
}

// ── Donut legend ───────────────────────────────────────────────────
function DonutLegend({ commitTypes }: { commitTypes: { name: string; value: number }[] }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
      {commitTypes.map((d, i) => (
        <div key={d.name} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: CHART_HEX_COLORS[i] }}
          />
          <span className="text-xs text-text-secondary">{d.name}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState("3m")
  const { dashboardStats, weeklyCommits, commitTypes, teamHeatmap, aiSummary } = useDBStore()
  const apiKey = useSettingsStore((s) => s.aiConfig.apiKey)

  // AI Dashboard Summary
  const getDashboardSummaryFn = useCallback(
    async (config: Parameters<typeof import("@/ai/tasks/dashboard-summary").getDashboardSummary>[0]) => {
      const { getDashboardSummary } = await import("@/ai/tasks/dashboard-summary")
      return getDashboardSummary(config)
    },
    []
  )
  const [aiState, aiActions] = useAITask(getDashboardSummaryFn, "dashboard_summary")

  const stats = [
    {
      icon: <GitCommit className="h-5 w-5" strokeWidth={1.75} />,
      label: "总提交",
      value: dashboardStats.totalCommits.toLocaleString(),
    },
    {
      icon: <Users className="h-5 w-5" strokeWidth={1.75} />,
      label: "活跃成员",
      value: dashboardStats.activeMembers.toLocaleString(),
    },
    {
      icon: <FileCode2 className="h-5 w-5" strokeWidth={1.75} />,
      label: "涉及文件",
      value: dashboardStats.filesInvolved.toLocaleString(),
    },
    {
      icon: <Code2 className="h-5 w-5" strokeWidth={1.75} />,
      label: "代码行数",
      value: dashboardStats.codeLines.toLocaleString(),
    },
  ]

  const trendOption = useCommitTrendOption(weeklyCommits)
  const typesOption = useCommitTypesOption(commitTypes)
  const heatmapOption = useHeatmapOption(teamHeatmap)

  const hasData = dashboardStats.totalCommits > 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        icon={<LayoutDashboard className="h-5 w-5" strokeWidth={1.75} />}
        title="仪表盘"
      >
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </PageHeader>

      {!hasData && (
        <EmptyState
          title="暂无分析数据"
          description="请先在首页选择一个 Git 仓库并完成分析"
        />
      )}

      {/* Bento Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Row 1 — Stat cards */}
        {stats.map((s) => (
          <StatCard
            key={s.label}
            icon={s.icon}
            label={s.label}
            value={s.value}
          />
        ))}

        {/* Row 2 — Commit trend (3 cols) + Donut (1 col) */}
        <ChartCard title="提交趋势" className="sm:col-span-2 lg:col-span-3">
          <ReactECharts
            option={trendOption}
            style={{ height: 260, width: "100%" }}
            opts={{ renderer: "svg" }}
          />
        </ChartCard>

        <ChartCard title="提交类型" className="flex flex-col">
          <ReactECharts
            option={typesOption}
            style={{ height: 210, width: "100%" }}
            opts={{ renderer: "svg" }}
          />
          <DonutLegend commitTypes={commitTypes} />
        </ChartCard>

        {/* Row 3 — Heatmap (full width) */}
        <ChartCard title="活跃时段" className="sm:col-span-2 lg:col-span-4">
          <ReactECharts
            option={heatmapOption}
            style={{ height: 220, width: "100%" }}
            opts={{ renderer: "svg" }}
          />
        </ChartCard>

        {/* Row 4 — AI Summary (full width) */}
        <div className="sm:col-span-2 lg:col-span-4">
          <AIInsightCard
            title="AI 洞察摘要"
            loading={aiState.loading}
            error={aiState.error?.message}
            onRefresh={() => aiActions.run()}
            noApiKey={!apiKey}
          >
            {aiState.data ? (
              <div>
                <p className="text-sm text-text-secondary">{aiState.data.summary}</p>
                {aiState.data.highlights.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {aiState.data.highlights.map((h, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <span className="font-semibold text-text">{h.metric}</span>
                        <span className="font-mono text-primary">{h.value}</span>
                        <span>{h.trend === 'up' ? '↑' : h.trend === 'down' ? '↓' : '→'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {aiState.fromCache && (
                  <p className="mt-2 text-[10px] text-text-muted">来自缓存</p>
                )}
              </div>
            ) : (
              aiSummary || null
            )}
          </AIInsightCard>
        </div>
      </div>
    </div>
  )
}
