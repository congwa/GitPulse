/**
 * useAIChat — 流式 AI 对话 Hook
 *
 * 封装：流式调用 → 逐字更新 → loading 状态 → 错误处理
 */

import { useState, useCallback, useRef } from 'react'
import { useSettingsStore } from '@/stores/settings'
import { useChatStore } from '@/stores/chat'

interface AIChatState {
  streaming: boolean
  error: Error | null
  currentToolCalls: string[]
}

export function useAIChat() {
  const [state, setState] = useState<AIChatState>({
    streaming: false,
    error: null,
    currentToolCalls: [],
  })
  const abortRef = useRef(false)

  const send = useCallback(async (userMessage: string) => {
    const config = useSettingsStore.getState().aiConfig
    const { addMessage, updateLastAssistant, setStreaming, messages } =
      useChatStore.getState()

    // 添加用户消息
    addMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    })

    // 添加空的 assistant 消息占位
    addMessage({
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    })

    abortRef.current = false
    setState({ streaming: true, error: null, currentToolCalls: [] })
    setStreaming(true)

    try {
      // 动态导入 AI 模块
      const { streamChat } = await import('@/ai/tasks/chat')

      // 构建消息历史
      const chatMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
      ]

      let fullContent = ''

      const generator = streamChat(config, chatMessages)

      for await (const chunk of generator) {
        if (abortRef.current) break

        if (chunk.type === 'tool_call' && chunk.tools) {
          setState((s) => ({
            ...s,
            currentToolCalls: chunk.tools!,
          }))
        } else if (chunk.type === 'text' && chunk.content) {
          fullContent = chunk.content
          updateLastAssistant(fullContent)
        }
      }

      setState({ streaming: false, error: null, currentToolCalls: [] })
    } catch (err) {
      if (!abortRef.current) {
        let error: Error
        try {
          const { handleAIError } = await import('@/ai/error-handler')
          error = handleAIError(err)
        } catch {
          error = err instanceof Error ? err : new Error(String(err))
        }
        setState({ streaming: false, error, currentToolCalls: [] })
        updateLastAssistant(`❌ ${error.message}`)
      }
    } finally {
      setStreaming(false)
    }
  }, [])

  const stop = useCallback(() => {
    abortRef.current = true
    setState((s) => ({ ...s, streaming: false }))
    useChatStore.getState().setStreaming(false)
  }, [])

  return {
    ...state,
    send,
    stop,
  }
}
