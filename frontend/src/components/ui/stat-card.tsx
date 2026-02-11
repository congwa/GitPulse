import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  trend?: number
  className?: string
}

export function StatCard({ icon, label, value, trend, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-surface rounded-[16px] border border-border p-5",
        "shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]",
        "hover:-translate-y-0.5 bounce-transition cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-primary-soft text-primary">
          {icon}
        </div>

        {trend !== undefined && trend !== 0 && (
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
              trend > 0
                ? "bg-accent-soft text-accent"
                : "bg-danger/10 text-danger"
            )}
          >
            {trend > 0 ? (
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>

      <div className="mt-4">
        <p className="font-mono text-2xl font-bold text-text">{value}</p>
        <p className="mt-0.5 text-sm text-text-secondary">{label}</p>
      </div>
    </div>
  )
}
