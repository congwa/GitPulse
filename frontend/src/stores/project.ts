import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface RecentRepo {
  path: string
  name: string
  memberCount: number
  lastAnalyzed: string | null
  status: 'completed' | 'partial' | 'git_only' | 'none'
}

export interface AnalysisMeta {
  repoPath: string
  repoName: string
  lastAnalyzed: number
  totalCommits: number
  totalAuthors: number
  status: 'completed' | 'partial' | 'git_only'
  durationMs: number
}

export interface PipelineProgress {
  stage: string
  stageIndex: number
  totalStages: number
  percent: number
  message: string
  detail?: string
  streamText?: string
  stageComplete?: boolean
  stageDuration?: number
}

interface ProjectState {
  repoPath: string | null
  repoName: string | null
  analysisMeta: AnalysisMeta | null
  isAnalyzing: boolean
  progress: PipelineProgress | null
  recentRepos: RecentRepo[]

  setRepo: (path: string, name: string) => void
  setAnalysisMeta: (meta: AnalysisMeta) => void
  setAnalyzing: (v: boolean) => void
  setProgress: (p: PipelineProgress | null) => void
  addRecentRepo: (repo: RecentRepo) => void
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      repoPath: null,
      repoName: null,
      analysisMeta: null,
      isAnalyzing: false,
      progress: null,
      recentRepos: [],

      setRepo: (path, name) => set({ repoPath: path, repoName: name }),
      setAnalysisMeta: (meta) => set({ analysisMeta: meta }),
      setAnalyzing: (v) => set({ isAnalyzing: v }),
      setProgress: (p) => set({ progress: p }),
      addRecentRepo: (repo) =>
        set((s) => ({
          recentRepos: [repo, ...s.recentRepos.filter((r) => r.path !== repo.path)].slice(0, 10),
        })),
    }),
    {
      name: 'gitpulse-project',
      version: 2,
      migrate: () => ({
        repoPath: null,
        repoName: null,
        analysisMeta: null,
        isAnalyzing: false,
        progress: null,
        recentRepos: [],
      }),
    }
  )
)
