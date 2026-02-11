import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Users, Clock, GitBranch, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores/project'
import { useDBStore, type RepoMeta } from '@/stores/db-store'
import { hasNewCommits } from '@/lib/git/git-service'
import { getDBSync } from '@/lib/database'

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return '未分析'
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return `${Math.floor(days / 30)} 个月前`
}

function RepoCard({
  repo,
  onClick,
  onDelete,
  isChecking,
}: {
  repo: RepoMeta
  onClick: () => void
  onDelete: () => void
  isChecking?: boolean
}) {
  const statusColor: Record<string, string> = {
    completed: 'bg-accent',
    partial: 'bg-warning',
    git_only: 'bg-secondary',
    none: 'bg-text-muted',
  }

  return (
    <div className="relative group flex-shrink-0 w-[180px]">
      {/* 删除按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className={cn(
          'absolute -top-2 -right-2 z-10',
          'flex items-center justify-center size-6 rounded-full',
          'bg-surface border border-border shadow-sm',
          'text-text-muted hover:text-danger hover:border-danger/30 hover:bg-danger/5',
          'opacity-0 group-hover:opacity-100',
          'transition-all duration-150 cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          isChecking && 'opacity-0 pointer-events-none'
        )}
        title="删除此项目"
      >
        <X className="size-3.5" strokeWidth={2} />
      </button>

      <button
        onClick={onClick}
        disabled={isChecking}
        className={cn(
          'w-full p-4 text-left cursor-pointer',
          'bg-surface rounded-[16px] border border-border',
          'shadow-[var(--shadow-card)]',
          'transition-all duration-200 ease-out',
          'hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-[3px]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
          isChecking && 'opacity-70 cursor-wait'
        )}
      >
        <div className="flex items-center gap-2 mb-3">
          {isChecking ? (
            <Loader2 className="size-4 text-primary animate-spin" strokeWidth={1.75} />
          ) : (
            <GitBranch className="size-4 text-primary" strokeWidth={1.75} />
          )}
          <span className="font-semibold text-sm text-text truncate flex-1">
            {repo.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-1.5">
          <Users className="size-3.5" strokeWidth={1.75} />
          <span>{repo.totalAuthors} 成员</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-text-muted mb-3">
          <Clock className="size-3.5" strokeWidth={1.75} />
          <span>{formatRelativeTime(repo.lastAnalyzed)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {isChecking ? (
            <span className="text-xs text-primary">检测新提交...</span>
          ) : (
            <>
              <span
                className={cn('size-2 rounded-full', statusColor[repo.status] ?? 'bg-text-muted')}
              />
              <span className="text-xs text-text-muted">
                {repo.status === 'completed'
                  ? '已完成'
                  : repo.status === 'partial'
                    ? '部分完成'
                    : repo.status === 'git_only'
                      ? '仅 Git'
                      : '未分析'}
              </span>
            </>
          )}
        </div>
      </button>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { setRepo } = useProjectStore()
  const repoMetas = useDBStore((s) => s.repoMetas)
  const deleteRepo = useDBStore((s) => s.deleteRepo)
  const [checkingRepo, setCheckingRepo] = useState<string | null>(null)

  async function handleSelectRepo(repo: RepoMeta) {
    setRepo(repo.path, repo.name)
    setCheckingRepo(repo.path)

    try {
      // 检查是否有新提交
      const db = getDBSync()
      if (!db) {
        // Database not initialized, proceed to analysis
        navigate('/analysis')
        return
      }
      const meta = db.getAnalysisMeta(repo.path)
      if (meta && meta.status === 'completed' && meta.commit_range) {
        const { hasNew } = await hasNewCommits(repo.path, meta.commit_range)
        if (!hasNew) {
          // 无新提交，直接进入仪表盘
          console.log('[Home] No new commits, navigating to dashboard')
          navigate('/dashboard')
          return
        }
        console.log('[Home] New commits detected, running analysis')
      }
    } catch (err) {
      console.warn('[Home] Failed to check for new commits:', err)
    } finally {
      setCheckingRepo(null)
    }

    // 有新提交或首次分析，进入分析页
    navigate('/analysis')
  }

  async function handleDropZoneClick() {
    // 检测 Tauri 环境
    if (window.__TAURI_INTERNALS__) {
      try {
        const { open } = await import(/* @vite-ignore */ '@tauri-apps/plugin-dialog')
        const selected = await open({ directory: true, title: '选择 Git 仓库' })
        if (selected) {
          const path = selected as string
          const name = path.split('/').pop() || path.split('\\').pop() || 'repo'
          setRepo(path, name)
          navigate('/analysis')
        }
      } catch (err) {
        console.error('Tauri dialog error:', err)
      }
    } else {
      // 浏览器环境降级方案
      const repoPath = prompt('请输入 Git 仓库路径：')
      if (repoPath) {
        const name = repoPath.split('/').pop() || repoPath.split('\\').pop() || 'repo'
        setRepo(repoPath, name)
        navigate('/analysis')
      }
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background overflow-hidden">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-primary-soft opacity-30 blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-secondary-soft opacity-30 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-accent-soft opacity-20 blur-[80px]" />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-xl px-6 py-12">
        {/* Logo & subtitle */}
        <div className="text-center mb-10">
          <h1 className="font-heading text-3xl text-primary font-bold tracking-tight mb-2">
            GitPulse
          </h1>
          <p className="text-text-secondary text-base font-body">
            用数据讲述团队的代码故事
          </p>
        </div>

        {/* Drop zone */}
        <button
          onClick={handleDropZoneClick}
          className={cn(
            'group w-full py-12 px-6 cursor-pointer',
            'border-2 border-dashed border-border rounded-[20px]',
            'bg-surface',
            'flex flex-col items-center gap-4',
            'transition-all duration-200 ease-out',
            'hover:border-primary hover:bg-primary-soft',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus'
          )}
        >
          <FolderOpen
            className="size-12 text-text-muted transition-colors duration-200 group-hover:text-primary"
            strokeWidth={1.75}
          />
          <span className="text-text-secondary text-sm transition-colors duration-200 group-hover:text-text">
            拖入项目文件夹，或点击选择
          </span>
        </button>

        {/* Recent projects */}
        {repoMetas.length > 0 && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold text-text-secondary mb-4 px-1">
              最近项目
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
              {repoMetas.map((repo) => (
                <RepoCard
                  key={repo.path}
                  repo={repo}
                  onClick={() => handleSelectRepo(repo)}
                  onDelete={() => deleteRepo(repo.path)}
                  isChecking={checkingRepo === repo.path}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
