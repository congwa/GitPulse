/**
 * useAITask — 结构化 AI 任务 Hook
 *
 * 封装：调用 → loading 状态 → 缓存 → 错误处理
 */

import { useState, useCallback, useRef } from 'react'
import { useSettingsStore, type AIConfig } from '@/stores/settings'

interface AITaskState<T> {
  data: T | null
  loading: boolean
  error: Error | null
  fromCache: boolean
}

interface AITaskActions<T> {
  run: () => Promise<T | null>
  reset: () => void
}

/**
 * @param taskFn - AI 任务函数，接收 AIConfig 返回结构化数据
 * @param cacheKey - 缓存键（type），传 null 禁用缓存
 * @param cacheTarget - 缓存目标（target），如成员邮箱
 */
export function useAITask<T>(
  taskFn: (config: AIConfig) => Promise<T>,
  cacheKey?: string | null,
  cacheTarget?: string,
): [AITaskState<T>, AITaskActions<T>] {
  const [state, setState] = useState<AITaskState<T>>({
    data: null,
    loading: false,
    error: null,
    fromCache: false,
  })

  const abortRef = useRef(false)

  const run = useCallback(async (): Promise<T | null> => {
    // 先检查缓存（动态导入 cache 模块）
    if (cacheKey) {
      try {
        const { getCachedResult } = await import('@/ai/cache')
        const cached = getCachedResult<T>(cacheKey, cacheTarget)
        if (cached) {
          setState({ data: cached, loading: false, error: null, fromCache: true })
          return cached
        }
      } catch {
        // 缓存模块加载失败，继续正常请求
      }
    }

    const config = useSettingsStore.getState().aiConfig
    abortRef.current = false
    setState((s) => ({ ...s, loading: true, error: null }))

    try {
      const result = await taskFn(config)

      if (abortRef.current) return null

      // 写入缓存
      if (cacheKey && result) {
        try {
          const { setCachedResult } = await import('@/ai/cache')
          setCachedResult(cacheKey, result, {
            target: cacheTarget,
            model: config.model,
          })
        } catch {
          // 缓存写入失败不影响结果
        }
      }

      setState({ data: result, loading: false, error: null, fromCache: false })
      return result
    } catch (err) {
      if (abortRef.current) return null

      // 动态导入错误处理
      let error: Error
      try {
        const { handleAIError } = await import('@/ai/error-handler')
        error = handleAIError(err)
      } catch {
        error = err instanceof Error ? err : new Error(String(err))
      }

      setState((s) => ({ ...s, loading: false, error }))
      return null
    }
  }, [taskFn, cacheKey, cacheTarget])

  const reset = useCallback(() => {
    abortRef.current = true
    setState({ data: null, loading: false, error: null, fromCache: false })
  }, [])

  return [state, { run, reset }]
}
