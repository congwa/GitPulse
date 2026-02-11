/**
 * Task: 自由对话（流式 Markdown）
 */

import { createGitPulseAgent } from '../agent'
import { AIMessage } from 'langchain'
import type { AIConfig } from '@/stores/settings'

export interface ChatStreamChunk {
  type: 'text' | 'tool_call'
  content?: string
  tools?: string[]
}

/**
 * 流式自由对话
 */
export async function* streamChat(
  config: AIConfig,
  messages: { role: string; content: string }[],
): AsyncGenerator<ChatStreamChunk> {
  const agent = createGitPulseAgent(config)

  const stream = await agent.stream(
    { messages },
    { streamMode: 'values' },
  )

  for await (const chunk of stream) {
    const latest = chunk.messages?.at(-1)

    if (latest && AIMessage.isInstance(latest)) {
      if (latest.tool_calls && latest.tool_calls.length > 0) {
        yield {
          type: 'tool_call',
          tools: latest.tool_calls.map((tc: { name: string }) => tc.name),
        }
      } else if (latest.content) {
        yield {
          type: 'text',
          content: String(latest.content),
        }
      }
    }
  }
}
