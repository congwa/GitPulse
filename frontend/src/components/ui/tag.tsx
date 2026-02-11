import { cn } from "@/lib/utils"

interface TagProps {
  children: React.ReactNode
  variant?: "primary" | "secondary" | "accent" | "danger" | "muted"
  className?: string
}

const variantStyles: Record<NonNullable<TagProps["variant"]>, string> = {
  primary: "bg-primary-soft text-primary",
  secondary: "bg-secondary-soft text-secondary",
  accent: "bg-accent-soft text-accent",
  danger: "bg-danger/10 text-danger",
  muted: "bg-muted text-text-muted",
}

export function Tag({ children, variant = "primary", className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
