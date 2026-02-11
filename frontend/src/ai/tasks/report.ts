/**
 * Task: 分析报告生成（流式 Markdown）
 */

import { createGitPulseAgent } from '../agent'
import { AIMessage } from 'langchain'
import type { AIConfig } from '@/stores/settings'

export type ReportType = 'weekly' | 'monthly' | 'full'

/**
 * 流式生成分析报告
 */
export async function* streamReport(
  config: AIConfig,
  reportType: ReportType,
) {
  const agent = createGitPulseAgent(config)

  const prompts: Record<ReportType, string> = {
    weekly: `请生成本周的仓库分析报告。包含：
1. 本周概览（提交量、活跃成员、代码变更）
2. 关键进展
3. 值得关注的变化
4. 建议

用 Markdown 格式输出，标题用 ##。`,

    monthly: `请生成本月的仓库分析报告。包含：
1. 月度概览（对比上月数据）
2. 团队贡献排行
3. 热门模块变化
4. 协作网络分析
5. 风险与建议

用 Markdown 格式输出，标题用 ##。`,

    full: `请生成仓库的完整分析报告。包含：
1. 项目概况
2. 团队结构与分工
3. 各成员画像
4. 模块归属热力图
5. 协作网络
6. 提交节奏与时间模式
7. 异常检测
8. 总结与建议

用 Markdown 格式输出，标题用 ##。`,
  }

  const stream = await agent.stream(
    {
      messages: [{ role: 'user', content: prompts[reportType] }],
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
