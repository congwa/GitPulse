/**
 * Task: 为成员生成角色标签（结构化输出）
 */

import { createAgent } from 'langchain'
import { createStructuredAgentParams } from '../agent'
import {
  MemberTagsSchema,
  type MemberTags,
  MemberBatchTagsSchema,
  type MemberBatchTags,
} from '../schemas/member'
import { MEMBER_TAGS_PROMPT } from '../prompts'
import type { AIConfig } from '@/stores/settings'

/**
 * 为单个成员生成标签
 */
export async function getMemberTags(
  config: AIConfig,
  email: string,
): Promise<MemberTags> {
  const baseParams = createStructuredAgentParams(config, MEMBER_TAGS_PROMPT)

  const agent = createAgent({
    ...baseParams,
    responseFormat: MemberTagsSchema,
  })

  const result = await agent.invoke({
    messages: [
      {
        role: 'user',
        content: `请查询成员 ${email} 的详细数据（提交量、工作时间模式、负责的模块、协作关系），然后为其生成角色标签和一句话画像。`,
      },
    ],
  })

  console.log('[MemberTags] Raw result:', JSON.stringify(result, null, 2))
  console.log('[MemberTags] structuredResponse:', result.structuredResponse)

  const structured = result.structuredResponse
  if (!structured || !Array.isArray(structured.tags)) {
    console.error('[MemberTags] Invalid structured data:', structured)
    throw new Error('AI 未返回有效的结构化数据 (MemberTags)')
  }
  return structured
}

/**
 * 批量为所有成员生成标签
 */
export async function getAllMemberTags(
  config: AIConfig,
): Promise<MemberBatchTags> {
  const baseParams = createStructuredAgentParams(config, MEMBER_TAGS_PROMPT)

  const agent = createAgent({
    ...baseParams,
    responseFormat: MemberBatchTagsSchema,
  })

  const result = await agent.invoke({
    messages: [
      {
        role: 'user',
        content:
          '请查询所有团队成员的数据概览，然后为每个人生成角色标签（最多3个）和一句话人物画像。',
      },
    ],
  })

  console.log('[MemberBatchTags] Raw result:', JSON.stringify(result, null, 2))
  console.log('[MemberBatchTags] structuredResponse:', result.structuredResponse)

  const structured = result.structuredResponse
  if (!structured || !Array.isArray(structured.members)) {
    console.error('[MemberBatchTags] Invalid structured data:', structured)
    throw new Error('AI 未返回有效的结构化数据 (MemberBatchTags)')
  }
  return structured
}
