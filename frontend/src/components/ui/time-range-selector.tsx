import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

interface TimeRangeSelectorProps {
  value: string
  onChange: (v: string) => void
}

const options = [
  { value: "1m", label: "近1月" },
  { value: "3m", label: "近3月" },
  { value: "6m", label: "近6月" },
  { value: "1y", label: "近1年" },
  { value: "all", label: "全部" },
]

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="选择时间范围"
        className={cn(
          "appearance-none rounded-[12px] border border-border bg-surface",
          "py-2 pl-3.5 pr-9 text-sm text-text",
          "shadow-[var(--shadow-card)] outline-none",
          "focus:border-border-focus focus:ring-2 focus:ring-primary/20",
          "bounce-transition cursor-pointer hover:bg-surface-hover"
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 h-4 w-4 text-text-muted"
        strokeWidth={1.75}
      />
    </div>
  )
}
