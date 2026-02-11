import { cn } from "@/lib/utils"

interface PageHeaderProps {
  icon: React.ReactNode
  title: string
  children?: React.ReactNode
}

export function PageHeader({ icon, title, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-primary-soft text-primary">
          {icon}
        </div>
        <h1 className="font-heading text-xl font-bold text-text sm:text-2xl">
          {title}
        </h1>
      </div>

      {children && (
        <div className="flex items-center gap-2">{children}</div>
      )}
    </div>
  )
}
