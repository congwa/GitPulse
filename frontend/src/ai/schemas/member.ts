/**
 * Member 相关的 Zod Schemas
 */

import { z } from 'zod'

export const MemberTagsSchema = z.object({
  tags: z
    .array(
      z.object({
        label: z.string().describe('标签文本，2-4个字'),
        color: z
          .enum(['blue', 'green', 'orange', 'purple', 'red', 'cyan'])
          .describe('标签颜色'),
      }),
    )
    .describe('成员角色标签，最多3个'),
  oneLiner: z.string().describe('一句话人物画像，不超过50字'),
})

export type MemberTags = z.infer<typeof MemberTagsSchema>

export const MemberBatchTagsSchema = z.object({
  members: z
    .array(
      z.object({
        email: z.string().describe('成员邮箱'),
        tags: z
          .array(
            z.object({
              label: z.string().describe('标签文本'),
              color: z
                .enum(['blue', 'green', 'orange', 'purple', 'red', 'cyan'])
                .describe('标签颜色'),
            }),
          )
          .describe('标签列表，最多3个'),
        oneLiner: z.string().describe('一句话画像'),
      }),
    )
    .describe('所有成员的标签'),
})

export type MemberBatchTags = z.infer<typeof MemberBatchTagsSchema>
