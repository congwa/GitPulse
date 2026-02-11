import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  User,
  FolderTree,
  Sparkles,
  Search,
  Settings,
  FolderOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectStore } from '@/stores/project'
import { useDBStore } from '@/stores/db-store'

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const repoName = useProjectStore((s) => s.repoName)
  const authorStats = useDBStore((s) => s.authorStats)

  // 动态获取第一个成员的 email，用于「成员画像」入口
  const firstMemberEmail = authorStats.length > 0 ? authorStats[0].email : null
  const memberLink = firstMemberEmail
    ? `/member/${encodeURIComponent(firstMemberEmail)}`
    : '/team' // 无成员时回退到团队页

  // 项目分析导航
  const PROJECT_NAV = [
    { id: 'dashboard', to: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
    { id: 'team', to: '/team', icon: Users, label: '团队全景' },
    { id: 'member', to: memberLink, icon: User, label: '成员画像' },
    { id: 'modules', to: '/modules', icon: FolderTree, label: '模块分析' },
    { id: 'insights', to: '/insights', icon: Sparkles, label: 'AI 洞察' },
    { id: 'waste', to: '/waste', icon: Search, label: '工贼检测' },
  ]

  // 全局功能导航
  const GLOBAL_NAV = [
    { id: 'settings', to: '/settings', icon: Settings, label: '设置' },
  ]

  const renderNavItem = ({ id, to, icon: Icon, label }: typeof PROJECT_NAV[0]) => {
    const isActive =
      to.startsWith('/member')
        ? location.pathname.startsWith('/member')
        : location.pathname === to
    return (
      <NavLink
        key={id}
        to={to}
        className={cn(
          'flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-[14px] font-medium transition-all duration-150 cursor-pointer',
          isActive
            ? 'bg-primary-soft text-primary font-semibold'
            : 'text-text-secondary hover:bg-surface-hover hover:text-text'
        )}
      >
        <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
        {label}
      </NavLink>
    )
  }

  return (
    <aside className="w-[220px] shrink-0 bg-surface border-r border-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border">
        <NavLink to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[10px] bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" strokeWidth={1.75} />
          </div>
          <span className="font-heading text-[18px] font-bold text-text">
            GitPulse
          </span>
        </NavLink>
      </div>

      {/* 项目选择器 */}
      <div className="px-3 py-3 border-b border-border">
        <div className="bg-surface-hover rounded-[12px] p-3">
          {repoName ? (
            <>
              <p className="text-[12px] text-text-muted mb-1">当前项目</p>
              <p className="text-[13px] font-semibold text-text truncate mb-2">
                {repoName}
              </p>
            </>
          ) : (
            <p className="text-[12px] text-text-muted mb-2">未选择项目</p>
          )}
          <button
            onClick={() => navigate('/')}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-3 py-2',
              'rounded-[10px] text-[13px] font-medium',
              'bg-background border border-border',
              'text-text-secondary hover:text-text hover:bg-surface',
              'transition-colors cursor-pointer'
            )}
          >
            <FolderOpen className="w-4 h-4" strokeWidth={1.75} />
            切换项目
          </button>
        </div>
      </div>

      {/* 项目分析导航 */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-1">
        {PROJECT_NAV.map(renderNavItem)}
      </nav>

      {/* 全局功能区 - 视觉分隔 */}
      <div className="px-3 pb-3">
        <div className="border-t border-border pt-3 flex flex-col gap-1">
          {GLOBAL_NAV.map(renderNavItem)}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[11px] text-text-muted">GitPulse v0.1.0</p>
      </div>
    </aside>
  )
}
