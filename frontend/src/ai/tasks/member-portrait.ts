/**
 * Task: 成员画像详情（流式 Markdown）
 */

import { createGitPulseAgent } from '../agent'
import { AIMessage } from 'langchain'
import type { AIConfig } from '@/stores/settings'

/**
 * 流式生成成员画像分析
 */
export async function* streamMemberPortrait(
  config: AIConfig,
  email: string,
) {
  const agent = createGitPulseAgent(config)

  const stream = await agent.stream(
    {
      messages: [
        {
          role: 'user',
          content: `请详细分析成员 ${email} 的工作画像。
包含以下维度：
1. **基础数据**：提交总量、活跃天数、平均提交大小
2. **工作节奏**：最活跃的时间段、工作时间偏好（早鸟/夜猫/稳定）
3. **技术领域**：主要负责的模块、擅长的代码类型
4. **协作模式**：最密切的协作者、协作强度
5. **趋势**：近期活跃度变化
6. **总结**：一段 3-5 句话的人物画像`,
        },
      ],
    },
    { streamMode: 'values' },
  )

  for await (const chunk of stream) {
    const latest = chunk.messages?.at(-1)

    if (latest && AIMessage.isInstance(latest)) {
      if (latest.tool_calls && latest.tool_calls.length > 0) {
        yield {
          type: 'tool_call' as const,
          tools: latest.tool_calls.map((tc: { name: string }) => tc.name),
        }
      } else if (latest.content) {
        yield {
          type: 'text' as const,
          content: String(latest.content),
        }
      }
    }
  }
}
