import { cn } from "@/lib/utils"

interface ProgressBarProps {
  percent: number
  className?: string
}

export function ProgressBar({ percent, className }: ProgressBarProps) {
  const clampedPercent = Math.max(0, Math.min(100, percent))

  return (
    <div
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-secondary bounce-transition"
        style={{ width: `${clampedPercent}%` }}
      />
    </div>
  )
}
