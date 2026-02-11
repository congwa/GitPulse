import { Sparkles, RefreshCw, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface AIInsightCardProps {
  icon?: React.ReactNode
  title?: string
  children?: React.ReactNode
  variant?: "default" | "portrait"
  borderColor?: string
  className?: string
  /** AI loading 状态 */
  loading?: boolean
  /** AI 错误信息 */
  error?: string | null
  /** 点击刷新/重新生成 */
  onRefresh?: () => void
  /** 是否显示 "AI 生成" 按钮（当没有内容且未配置 API Key 时） */
  noApiKey?: boolean
}

export function AIInsightCard({
  icon,
  title,
  children,
  variant = "default",
  borderColor,
  className,
  loading,
  error,
  onRefresh,
  noApiKey,
}: AIInsightCardProps) {
  const isPortrait = variant === "portrait"

  return (
    <div
      className={cn(
        "relative rounded-[16px] border border-border bg-surface",
        "shadow-[var(--shadow-card)]",
        isPortrait
          ? "border-l-[5px] p-6"
          : "border-l-[3px] p-4",
        className
      )}
      style={{
        borderLeftColor: borderColor ?? "var(--secondary)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-[10px] bg-secondary-soft text-secondary",
            isPortrait ? "h-10 w-10" : "h-8 w-8"
          )}
        >
          {loading ? (
            <Loader2
              className={cn("animate-spin", isPortrait ? "h-5 w-5" : "h-4 w-4")}
              strokeWidth={1.75}
            />
          ) : (
            icon ?? (
              <Sparkles
                className={isPortrait ? "h-5 w-5" : "h-4 w-4"}
                strokeWidth={1.75}
              />
            )
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {title && (
              <p
                className={cn(
                  "font-heading font-semibold text-text flex-1",
                  isPortrait ? "text-base" : "text-sm"
                )}
              >
                {title}
              </p>
            )}
            {onRefresh && !loading && (
              <button
                onClick={onRefresh}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-text-muted hover:text-primary hover:bg-primary-soft transition-colors cursor-pointer"
                title="重新生成"
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="mt-2 space-y-2 animate-pulse">
              <div className="h-3 w-4/5 rounded bg-border" />
              <div className="h-3 w-3/5 rounded bg-border" />
              <div className="h-3 w-2/3 rounded bg-border" />
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="mt-2 flex items-start gap-2 text-danger">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.75} />
              <p className="text-xs leading-relaxed">{error}</p>
            </div>
          )}

          {/* No API Key hint */}
          {noApiKey && !loading && !error && !children && (
            <div className="mt-2">
              <p className="text-xs text-text-muted">
                请先在设置中配置 AI API Key，即可获取 AI 分析洞察。
              </p>
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className={cn(
                    "mt-2 inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5",
                    "text-xs font-semibold text-primary bg-primary-soft",
                    "cursor-pointer hover:opacity-90 transition-opacity"
                  )}
                >
                  <Sparkles className="h-3 w-3" strokeWidth={2} />
                  AI 生成
                </button>
              )}
            </div>
          )}

          {/* Normal content */}
          {!loading && !error && children && (
            <div
              className={cn(
                "text-text-secondary leading-relaxed",
                isPortrait ? "mt-2 text-sm" : "mt-1 text-xs",
                title ? "" : "mt-0"
              )}
            >
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
