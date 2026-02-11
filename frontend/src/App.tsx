import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { AISetupGuard } from '@/components/ai-setup-guard'
import { AppLayout } from '@/components/layout/app-layout'
import { getDB } from '@/lib/database'
import { seedDatabase } from '@/lib/database/seed'
import { useDBStore } from '@/stores/db-store'
import Home from '@/pages/home'
import Analysis from '@/pages/analysis'
import Dashboard from '@/pages/dashboard'
import Team from '@/pages/team'
import Member from '@/pages/member'
import Modules from '@/pages/modules'
import Insights from '@/pages/insights'
import Waste from '@/pages/waste'
import Settings from '@/pages/settings'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-[14px] bg-primary-soft flex items-center justify-center animate-pulse">
          <span className="text-primary text-xl font-bold">G</span>
        </div>
        <p className="text-text-secondary text-sm">
          初始化数据库...
        </p>
      </div>
    </div>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <div className="w-12 h-12 mx-auto mb-4 rounded-[14px] bg-danger/10 flex items-center justify-center">
          <span className="text-danger text-xl">!</span>
        </div>
        <p className="text-text font-semibold mb-2">数据库初始化失败</p>
        <p className="text-text-secondary text-sm">{message}</p>
      </div>
    </div>
  )
}

export default function App() {
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const loadFromDB = useDBStore((s) => s.loadFromDB)

  useEffect(() => {
    async function initDB() {
      try {
        // 1. 初始化 SQLite (sql.js WASM)
        const db = await getDB()

        // 2. Seed demo 数据（如果是首次运行）
        await seedDatabase(db)

        // 3. 加载数据到 Zustand store（异步分片加载）
        await loadFromDB()

        setDbReady(true)
        console.log('[App] Database initialized and data loaded')
      } catch (err) {
        console.error('[App] Database init failed:', err)
        setDbError(String(err))
      }
    }
    initDB()
  }, [loadFromDB])

  if (dbError) return <ErrorScreen message={dbError} />
  if (!dbReady) return <LoadingScreen />

  return (
    <ThemeProvider defaultTheme="light" storageKey="gitpulse-theme">
      <BrowserRouter>
        <AISetupGuard>
          <Routes>
            {/* 全屏页面（无侧边栏） */}
            <Route path="/" element={<Home />} />
            <Route path="/analysis" element={<Analysis />} />

            {/* 带侧边栏的页面 */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/team" element={<Team />} />
              <Route path="/member/:email" element={<Member />} />
              <Route path="/modules" element={<Modules />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/waste" element={<Waste />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </AISetupGuard>
      </BrowserRouter>
    </ThemeProvider>
  )
}
