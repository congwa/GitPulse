/**
 * Task: 团队洞察分析（结构化输出）
 */

import { createAgent } from 'langchain'
import { createStructuredAgentParams } from '../agent'
import { TeamInsightsSchema, type TeamInsights } from '../schemas/insights'
import { TEAM_INSIGHTS_PROMPT } from '../prompts'
import type { AIConfig } from '@/stores/settings'

/**
 * 从 Agent 最后一条 AI 消息中尝试提取 JSON
 */
function extractStructuredFromMessages(messages: unknown[]): TeamInsights | null {
  // 从后往前找最后一条 AI 消息
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as { content?: string; _getType?: () => string; tool_calls?: unknown[] }
    const msgType = msg?._getType?.()

    // 跳过非 AI 消息
    if (msgType !== 'ai') continue

    // 如果 AI 消息有 tool_calls 但没有 content，跳过（这是工具调用中间步骤）
    if (msg.tool_calls?.length && !msg.content) continue

    const content = msg.content
    if (typeof content !== 'string' || !content.trim()) continue

    console.log(`[TeamInsights] Checking AI message[${i}] content (${content.length} chars):`, content.slice(0, 300))

    // 尝试提取 JSON 块
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*"insights"[\s\S]*\}/)
    if (!jsonMatch) {
      console.log(`[TeamInsights] No JSON pattern found in message[${i}]`)
      continue
    }

    try {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      console.log(`[TeamInsights] Extracted JSON (${jsonStr.length} chars):`, jsonStr.slice(0, 200))
      const parsed = JSON.parse(jsonStr)
      const validated = TeamInsightsSchema.safeParse(parsed)
      if (validated.success) return validated.data
      console.warn(`[TeamInsights] Zod validation failed:`, validated.error.issues)
    } catch (e) {
      console.warn(`[TeamInsights] JSON parse failed in message[${i}]:`, e)
    }
  }
  return null
}

export async function getTeamInsights(
  config: AIConfig,
): Promise<TeamInsights> {
  const baseParams = createStructuredAgentParams(config, TEAM_INSIGHTS_PROMPT)

  console.log('[TeamInsights] Creating agent with config:', {
    provider: config.provider,
    model: config.model,
    hasResponseFormat: true,
    schemaShape: Object.keys(TeamInsightsSchema.shape),
  })

  const agent = createAgent({
    ...baseParams,
    responseFormat: TeamInsightsSchema,
  })

  const result = await agent.invoke(
    {
      messages: [
        {
          role: 'user',
          content: `请综合查询以下数据，生成团队洞察：
1. 提交统计（最近 90 天）
2. 团队成员活跃度
3. 模块归属情况
4. 协作网络
5. 异常检测（巴士因子、提交节奏、成员活跃度）

给出 3-5 条有价值的洞察和团队健康度评分。
必须以 JSON 格式输出，包含 insights 数组和 teamHealthScore 数字。`,
        },
      ],
    },
    {
      recursionLimit: 40,
    },
  )

  // ===== 诊断日志 =====
  console.log('[TeamInsights] ===== 诊断开始 =====')
  console.log('[TeamInsights] result 顶层 keys:', Object.keys(result))
  console.log('[TeamInsights] result.structuredResponse:', result.structuredResponse)
  console.log('[TeamInsights] typeof structuredResponse:', typeof result.structuredResponse)

  if (result.messages && Array.isArray(result.messages)) {
    console.log('[TeamInsights] 消息总数:', result.messages.length)

    // 打印每条消息的摘要
    result.messages.forEach((msg: unknown, idx: number) => {
      const m = msg as {
        _getType?: () => string
        content?: string | unknown[]
        tool_calls?: unknown[]
        name?: string
        additional_kwargs?: Record<string, unknown>
      }
      const type = m._getType?.() ?? 'unknown'
      const contentPreview = typeof m.content === 'string'
        ? m.content.slice(0, 120)
        : Array.isArray(m.content)
          ? `[Array(${m.content.length})]`
          : String(m.content)
      const toolCalls = m.tool_calls?.length ?? 0
      const name = m.name ?? ''

      console.log(
        `[TeamInsights] msg[${idx}] type=${type} toolCalls=${toolCalls} name=${name} content=${contentPreview}`
      )

      // 如果是最后一条 AI 消息，打印完整内容和 additional_kwargs
      if (type === 'ai' && idx >= result.messages.length - 3) {
        console.log(`[TeamInsights] msg[${idx}] FULL content:`, m.content)
        console.log(`[TeamInsights] msg[${idx}] additional_kwargs:`, m.additional_kwargs)
        console.log(`[TeamInsights] msg[${idx}] tool_calls:`, m.tool_calls)
      }
    })
  } else {
    console.warn('[TeamInsights] result.messages 不存在或不是数组:', result.messages)
  }
  console.log('[TeamInsights] ===== 诊断结束 =====')

  // 优先使用 structuredResponse
  if (result.structuredResponse && Array.isArray(result.structuredResponse.insights)) {
    console.log('[TeamInsights] ✓ 使用 structuredResponse 成功')
    return result.structuredResponse
  }

  // 降级：从消息内容中提取 JSON
  console.warn('[TeamInsights] structuredResponse 不可用 (值为', result.structuredResponse, ')，尝试从消息中提取')
  if (result.messages && Array.isArray(result.messages)) {
    const extracted = extractStructuredFromMessages(result.messages)
    if (extracted) {
      console.log('[TeamInsights] ✓ 降级提取成功')
      return extracted
    }
  }

  console.error('[TeamInsights] ✗ 所有提取方式均失败')
  throw new Error('AI 未返回有效的结构化数据 (TeamInsights)')
}
