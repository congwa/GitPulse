import { FolderOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: React.ReactNode
  title?: string
  description?: string
  actionLabel?: string
  actionTo?: string
  className?: string
}

export function EmptyState({
  icon,
  title = '暂无数据',
  description = '请先选择一个 Git 仓库进行分析',
  actionLabel = '选择仓库',
  actionTo = '/',
  className,
}: EmptyStateProps) {
  const navigate = useNavigate()

  return (
    <div className={cn('flex flex-col items-center justify-center py-20 text-center', className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-primary-soft text-primary mb-5">
        {icon ?? <FolderOpen className="h-7 w-7" strokeWidth={1.75} />}
      </div>
      <h3 className="font-heading text-lg font-semibold text-text mb-1.5">{title}</h3>
      <p className="text-sm text-text-secondary max-w-xs mb-6">{description}</p>
      {actionTo && (
        <button
          onClick={() => navigate(actionTo)}
          className={cn(
            'inline-flex items-center gap-2 rounded-[12px] px-5 py-2.5 text-sm font-semibold',
            'bg-primary text-primary-foreground cursor-pointer hover:opacity-90'
          )}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
