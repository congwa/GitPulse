/**
 * 工贼检测 — 分析引擎主流程
 *
 * 两层策略：
 * 1. 快速预扫描（SQLite 统计驱动，零 LLM 开销）
 * 2. DeepAgent 深度分析（多级 Agent 协作，读源码 + 跑 git 命令）
 */

import { getDBSync, type GitPulseDB } from '@/lib/database'
import { createWasteDetectionAgent } from './factory'
import { preScanSuspects, formatScanForPrompt } from './pre-scan'
import { emitActivity, resetActivityChannel } from './activity-channel'
import type { AIConfig } from '@/stores/settings'
import type {
  WasteReport,
  WasteEvent,
  WasteScore,
  AnalysisProgress,
} from './types'

const TAG = '[WasteAnalysis]'

/**
 * 运行完整的工贼检测分析
 *
 * @param config - AI 配置（模型、API Key 等）
 * @param repoPath - Git 仓库本地路径
 * @param onProgress - 进度回调
 * @returns 完整的分析报告
 */
export async function runWasteAnalysis(
  config: AIConfig,
  repoPath: string,
  onProgress?: (p: AnalysisProgress) => void,
): Promise<WasteReport> {
  const t0 = performance.now()
  const analysisId = `waste-${Date.now()}`

  console.log(`${TAG} ========================================`)
  console.log(`${TAG} 工贼检测分析开始`)
  console.log(`${TAG} analysisId: ${analysisId}`)
  console.log(`${TAG} repoPath: ${repoPath}`)
  console.log(`${TAG} model: ${config.model}, provider: ${config.provider}`)
  console.log(`${TAG} ========================================`)

  // 重置活动通道
  resetActivityChannel()
  emitActivity('phase', '工贼检测分析开始', `仓库: ${repoPath.split('/').pop()}`)

  // ---- Phase 1: 预扫描 ----
  console.log(`${TAG} ---- Phase 1: 预扫描 ----`)
  emitActivity('phase', '快速预扫描...', '基于 SQLite 统计数据筛选嫌疑目标')
  onProgress?.({ stage: 'pre-scan', percent: 5, message: '快速预扫描...', eventsFound: 0 })

  const db = getDBSync()
  if (!db) {
    console.error(`${TAG} 数据库未初始化!`)
    throw new Error('数据库未初始化')
  }
  console.log(`${TAG} 数据库连接成功`)

  const suspects = preScanSuspects(db)
  const scanPrompt = formatScanForPrompt(suspects)

  console.log(`${TAG} 预扫描完成:`)
  console.log(`${TAG}   嫌疑文件: ${suspects.hotFiles.length}`)
  console.log(`${TAG}   嫌疑作者: ${suspects.suspectAuthors.length}`)
  console.log(`${TAG}   接力异常: ${suspects.hotHandoffs.length}`)
  console.log(`${TAG}   revert: ${suspects.reverts.length}`)
  console.log(`${TAG}   scanPrompt: ${scanPrompt.length} chars`)

  emitActivity(
    'info',
    `预扫描完成: ${suspects.hotFiles.length} 嫌疑文件, ${suspects.suspectAuthors.length} 嫌疑作者`,
    suspects.suspectAuthors.map(a => `${a.authorName || a.authorEmail} (删除比${(a.deleteRatio * 100).toFixed(0)}%)`).join(', '),
  )

  onProgress?.({
    stage: 'pre-scan',
    percent: 10,
    message: `发现 ${suspects.hotFiles.length} 个嫌疑文件，${suspects.suspectAuthors.length} 个嫌疑作者`,
    eventsFound: 0,
  })

  // ---- Phase 2: DeepAgent 深度分析 ----
  console.log(`${TAG} ---- Phase 2: DeepAgent 深度分析 ----`)
  emitActivity('phase', '启动 DeepAgent 深度分析', '多 Agent 协作: git-forensics / code-archaeologist / pattern-detective')
  onProgress?.({ stage: 'deep-analysis', percent: 15, message: '启动 DeepAgent 深度分析...', eventsFound: 0 })

  console.log(`${TAG} 创建 Agent...`)
  const agent = createWasteDetectionAgent(config, repoPath)
  console.log(`${TAG} Agent 创建完成`)

  const userPrompt = `请对这个 Git 仓库进行工贼检测分析。

${scanPrompt}

## 分析策略（重要：效率优先）
1. **仅分析 Top 3-5 最可疑的文件/作者**，不要试图分析所有嫌疑文件
2. 对每个嫌疑文件，一次 task 调用获取足够信息（不要重复调用同一个 SubAgent）
3. 每个 SubAgent 调用时，给出明确的问题和所需信息，避免模糊指令导致多轮对话
4. 尽快生成报告，不必做到完美覆盖

## 分析步骤
1. 先用 git-forensics 批量获取 Top 嫌疑文件的变更历史
2. 再用 code-archaeologist 查看关键代码（仅必要时）
3. 用 pattern-detective 做最终判定
4. **在完成 3-5 个文件分析后立即生成报告**

最终输出一个 JSON 对象（用 \`\`\`json 包裹），包含：
{
  "summary": "一段话总结",
  "events": [{ "patternId", "severity", "authorEmail", "relatedAuthors", "filePaths", "commitHashes", "linesWasted", "wasPassive", "description", "evidence", "rootCause", "recommendation" }],
  "ranking": [{ "email", "name", "wasteScore", "wasteRate", "topPattern", "linesWasted", "passiveWasteLines" }],
  "teamRecommendations": ["建议1", "建议2", ...]
}`

  console.log(`${TAG} userPrompt: ${userPrompt.length} chars`)
  console.log(`${TAG} 开始流式执行 (recursionLimit=300)...`)

  // 流式执行
  let lastContent = ''
  const allContents: string[] = []
  let eventsFound = 0
  let chunkCount = 0
  let modelCallCount = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastChunkMessages: any[] = []

  /**
   * 检测消息类型 — 兼容 LangChain 实例和 stream 中的纯对象
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getMsgType(msg: any): string {
    if (!msg) return 'unknown'
    // 1. LangChain message instance
    if (typeof msg._getType === 'function') return msg._getType()
    // 2. 直接 type 属性（stream 中的纯对象）
    if (typeof msg.type === 'string' && ['ai', 'human', 'tool', 'system'].includes(msg.type)) return msg.type
    // 3. constructor name（AIMessage / HumanMessage / ToolMessage）
    const name = msg.constructor?.name
    if (name && name !== 'Object') {
      if (name.includes('AI') || name.includes('Ai')) return 'ai'
      if (name.includes('Human')) return 'human'
      if (name.includes('Tool')) return 'tool'
    }
    // 4. kwargs.type（LangChain 序列化格式）
    if (msg.kwargs?.type) return msg.kwargs.type
    // 5. role（OpenAI 格式）
    if (msg.role === 'assistant') return 'ai'
    if (msg.role === 'user') return 'human'
    if (msg.role === 'tool') return 'tool'
    // 6. 根据属性推断
    if (msg.tool_calls !== undefined || msg.additional_kwargs?.tool_calls) return 'ai'
    if (msg.tool_call_id !== undefined) return 'tool'
    return 'unknown'
  }

  try {
    // 使用 streamMode: 'values' 确保每个 chunk 包含完整的 messages 数组
    // 默认的 'updates' 模式 chunk 结构为 { nodeId: { messages: [...] } }
    // 而非 { messages: [...] }，会导致 chunk.messages 为 undefined
    const stream = await agent.stream(
      {
        messages: [{ role: 'user', content: userPrompt }],
      },
      {
        recursionLimit: 300,
        streamMode: 'values',
      },
    )
    console.log(`${TAG} stream 创建成功 (streamMode=values)，开始接收 chunk...`)

    for await (const chunk of stream) {
      chunkCount++

      // 提取进度信息
      if (chunk.messages && chunk.messages.length > 0) {
        // 保存最新的完整消息列表（stream values 模式下，每个 chunk 是全状态）
        lastChunkMessages = chunk.messages

        const lastMsg = chunk.messages[chunk.messages.length - 1]
        const msgType = getMsgType(lastMsg)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolCalls = (lastMsg as any)?.tool_calls?.length ?? (lastMsg as any)?.additional_kwargs?.tool_calls?.length ?? 0
        const msgName = lastMsg?.name ?? ''
        const contentStr = typeof lastMsg?.content === 'string' ? lastMsg.content : ''

        // 计算 AI 模型调用次数
        if (msgType === 'ai') modelCallCount++

        // 仅每 5 个 chunk 或 AI 消息时打印（减少日志噪音）
        if (chunkCount <= 3 || chunkCount % 5 === 0 || msgType === 'ai') {
          console.log(
            `${TAG} chunk #${chunkCount}: msgType=${msgType}, toolCalls=${toolCalls}, name=${msgName}, ` +
            `msgCount=${chunk.messages.length}, modelCalls=${modelCallCount}` +
            (contentStr ? `, contentLen=${contentStr.length}` : '')
          )
        }

        if (contentStr.trim() && !contentStr.startsWith('Model call limits')) {
          lastContent = contentStr
          allContents.push(contentStr)

          // 打印内容预览
          console.log(`${TAG} chunk #${chunkCount} content (${contentStr.length} chars): ${contentStr.slice(0, 150).replace(/\n/g, '\\n')}...`)

          // 粗略估算进度
          const jsonMatches = contentStr.match(/"patternId"/g)
          if (jsonMatches) {
            eventsFound = jsonMatches.length
          }

          onProgress?.({
            stage: 'deep-analysis',
            percent: Math.min(15 + eventsFound * 8, 85),
            message: `分析中... 已发现 ${eventsFound} 个无用功事件`,
            eventsFound,
          })
        }
      }
    }

    console.log(`${TAG} 流式执行完成: ${chunkCount} 个 chunk, ${modelCallCount} 次模型调用`)
    console.log(`${TAG} 累积内容: ${allContents.length} 段, 总 ${allContents.reduce((s, c) => s + c.length, 0)} chars`)
    console.log(`${TAG} 最终消息数: ${lastChunkMessages.length}`)

    // ---- 关键修复：从全量消息列表中提取最终 AI 回复 ----
    // stream 结束后，检查完整消息历史，找到最后一条包含实质内容的 AI 消息
    if (!lastContent && lastChunkMessages.length > 0) {
      console.log(`${TAG} 未在 stream 中捕获到内容，扫描全量消息...`)
      for (let i = lastChunkMessages.length - 1; i >= 0; i--) {
        const msg = lastChunkMessages[i]
        const type = getMsgType(msg)
        const content = typeof msg?.content === 'string' ? msg.content : ''

        if (content.trim() && !content.startsWith('Model call limits')) {
          console.log(`${TAG} 找到消息 msg[${i}] type=${type} (${content.length} chars): ${content.slice(0, 100).replace(/\n/g, '\\n')}...`)
          // 优先找包含 JSON 报告的 AI 消息
          if (content.includes('"events"') || content.includes('"patternId"') || content.includes('```json')) {
            lastContent = content
            allContents.push(content)
            console.log(`${TAG} ✓ 使用 msg[${i}] 作为最终输出 (含 JSON)`)
            break
          }
          // 备选：任何有实质内容的 AI 消息
          if (type === 'ai' && content.length > 50 && !lastContent) {
            lastContent = content
            allContents.push(content)
            console.log(`${TAG} 暂存 msg[${i}] 作为备选 AI 输出`)
          }
        }
      }

      // 如果 AI 没有直接输出 JSON，但 SubAgent 的 task 工具返回了有用内容
      // 从 tool response messages 中提取 SubAgent 的分析结果
      if (!lastContent) {
        console.log(`${TAG} 无 AI 文本输出，尝试从 SubAgent task 返回值中提取...`)
        const taskResults: string[] = []
        for (let i = 0; i < lastChunkMessages.length; i++) {
          const msg = lastChunkMessages[i]
          const type = getMsgType(msg)
          const content = typeof msg?.content === 'string' ? msg.content : ''
          const name = msg?.name ?? ''
          if (type === 'tool' && name === 'task' && content.length > 100) {
            taskResults.push(content)
            console.log(`${TAG} 收集 task 结果 msg[${i}] (${content.length} chars)`)
          }
        }
        if (taskResults.length > 0) {
          lastContent = taskResults.join('\n\n---\n\n')
          allContents.push(lastContent)
          console.log(`${TAG} 合并 ${taskResults.length} 个 SubAgent 结果作为分析依据 (${lastContent.length} chars)`)
        }
      }
    }

    console.log(`${TAG} 最终内容 (${lastContent.length} chars): ${lastContent.slice(0, 300).replace(/\n/g, '\\n')}...`)
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`${TAG} Agent 执行出错: ${errMsg}`)
    console.error(`${TAG} 出错时状态: ${chunkCount} 个 chunk, ${modelCallCount} 次模型调用, ${allContents.length} 段内容`)

    // 优雅降级：如果是递归限制错误或 modelCallLimit，尝试从已有内容中提取部分结果
    const isRecoverableError = errMsg.includes('Recursion limit') || errMsg.includes('Model call limits')
    const hasUsableContent = allContents.length > 0 || lastChunkMessages.length > 0

    if (isRecoverableError && hasUsableContent) {
      console.warn(`${TAG} ⚠ ${isRecoverableError ? '限制触发' : '出错'}，尝试提取部分结果...`)
      onProgress?.({
        stage: 'deep-analysis',
        percent: 80,
        message: '分析限制触发，正在提取已有分析结果...',
        eventsFound,
      })

      // 从所有累积内容中找最佳的 JSON 块
      const combinedContent = allContents.join('\n\n')
      console.log(`${TAG} 合并内容: ${combinedContent.length} chars`)

      const jsonMatch = combinedContent.match(/```json\s*([\s\S]*?)```/)
      if (jsonMatch) {
        console.log(`${TAG} ✓ 找到 JSON 代码块 (${jsonMatch[0].length} chars)`)
        lastContent = jsonMatch[0]
      } else {
        // 从全量消息中搜索
        for (let i = lastChunkMessages.length - 1; i >= 0; i--) {
          const msg = lastChunkMessages[i]
          const content = typeof msg?.content === 'string' ? msg.content : ''
          if (content.includes('"events"') || content.includes('```json')) {
            lastContent = content
            console.log(`${TAG} ✓ 从 msg[${i}] 提取到含 JSON 的内容 (${content.length} chars)`)
            break
          }
        }
      }

      if (!lastContent) {
        // 最后手段：收集所有 task 工具返回的结果
        const taskResults: string[] = []
        for (const msg of lastChunkMessages) {
          const type = getMsgType(msg)
          const content = typeof msg?.content === 'string' ? msg.content : ''
          if (type === 'tool' && msg?.name === 'task' && content.length > 100) {
            taskResults.push(content)
          }
        }
        if (taskResults.length > 0) {
          lastContent = taskResults.join('\n\n---\n\n')
          console.log(`${TAG} 使用 ${taskResults.length} 个 SubAgent 结果作为降级输出`)
        }
      }

      if (!lastContent) {
        console.error(`${TAG} 无法提取有效结果`)
        throw new Error('DeepAgent 分析限制触发且无法提取有效结果。请尝试减少分析范围。')
      }
      console.log(`${TAG} 使用降级内容继续解析...`)
    } else {
      throw new Error(`DeepAgent 分析失败: ${errMsg}`)
    }
  }

  // ---- Phase 3: 解析报告 ----
  console.log(`${TAG} ---- Phase 3: 解析报告 ----`)
  console.log(`${TAG} 待解析内容: ${lastContent.length} chars`)
  emitActivity('phase', '解析分析报告...', `${lastContent.length} 字符的分析结果`)
  onProgress?.({ stage: 'report', percent: 90, message: '解析分析报告...', eventsFound })

  const report = parseAgentOutput(lastContent, analysisId, repoPath, t0)

  console.log(`${TAG} 报告解析完成:`)
  console.log(`${TAG}   events: ${report.events.length} 个`)
  console.log(`${TAG}   ranking: ${report.ranking.length} 人`)
  console.log(`${TAG}   summary: ${report.summary.length} chars`)
  console.log(`${TAG}   teamRecommendations: ${report.teamRecommendations.length} 条`)
  console.log(`${TAG}   durationMs: ${report.analysisStats.durationMs.toFixed(0)}ms`)

  // 保存到数据库
  console.log(`${TAG} 保存到数据库...`)
  saveReportToDB(db, report)
  console.log(`${TAG} 数据库保存完成`)

  onProgress?.({ stage: 'report', percent: 100, message: '分析完成', eventsFound: report.events.length })

  const totalDuration = ((performance.now() - t0) / 1000).toFixed(1)
  console.log(`${TAG} ========================================`)
  console.log(`${TAG} 工贼检测分析完成! 总耗时: ${totalDuration}s`)
  console.log(`${TAG} ========================================`)
  emitActivity('phase', `分析完成! 耗时 ${totalDuration}s`, `${report.events.length} 个事件, ${report.ranking.length} 人`)

  return report
}

/**
 * 解析 Agent 的 JSON 输出
 */
function parseAgentOutput(
  content: string,
  analysisId: string,
  repoPath: string,
  startTime: number,
): WasteReport {
  console.log(`${TAG} [parseAgentOutput] 开始解析, 内容长度: ${content.length}`)

  // 尝试提取 JSON 块
  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*"events"[\s\S]*\}/)
  let parsed: Record<string, unknown> = {}

  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      console.log(`${TAG} [parseAgentOutput] 提取 JSON: ${jsonStr.length} chars`)
      console.log(`${TAG} [parseAgentOutput] JSON 预览: ${jsonStr.slice(0, 200).replace(/\n/g, '\\n')}...`)
      parsed = JSON.parse(jsonStr)
      console.log(`${TAG} [parseAgentOutput] JSON 解析成功, keys: ${Object.keys(parsed).join(', ')}`)
    } catch (err) {
      console.warn(`${TAG} [parseAgentOutput] JSON 解析失败:`, err)
      console.warn(`${TAG} [parseAgentOutput] 原始 JSON 片段: ${(jsonMatch[1] || jsonMatch[0]).slice(0, 300)}`)
    }
  } else {
    console.warn(`${TAG} [parseAgentOutput] 未找到 JSON 块!`)
    console.warn(`${TAG} [parseAgentOutput] 内容预览: ${content.slice(0, 500).replace(/\n/g, '\\n')}`)
  }

  // 解析 events
  const rawEvents = (parsed.events as Record<string, unknown>[]) || []
  console.log(`${TAG} [parseAgentOutput] 原始 events: ${rawEvents.length} 个`)
  const events: WasteEvent[] = rawEvents.map((e, i) => {
    const event: WasteEvent = {
      patternId: (e.patternId as WasteEvent['patternId']) || 'W1',
      severity: (e.severity as WasteEvent['severity']) || 'medium',
      authorEmail: (e.authorEmail as string) || '',
      relatedAuthors: (e.relatedAuthors as string[]) || [],
      filePaths: (e.filePaths as string[]) || [],
      commitHashes: (e.commitHashes as string[]) || [],
      linesWasted: (e.linesWasted as number) || 0,
      wasPassive: (e.wasPassive as boolean) || false,
      description: (e.description as string) || '',
      evidence: (e.evidence as string) || '',
      rootCause: (e.rootCause as string) || '',
      recommendation: (e.recommendation as string) || '',
      detectedAt: Date.now(),
      analysisId,
    }
    console.log(`${TAG} [parseAgentOutput]   event[${i}]: ${event.patternId} ${event.severity} "${event.description.slice(0, 60)}" by ${event.authorEmail}`)
    return event
  })

  // 解析 ranking
  const rawRanking = (parsed.ranking as Record<string, unknown>[]) || []
  console.log(`${TAG} [parseAgentOutput] 原始 ranking: ${rawRanking.length} 人`)
  const ranking: WasteScore[] = rawRanking.map((r, i) => {
    const score: WasteScore = {
      authorEmail: (r.email as string) || '',
      authorName: (r.name as string) || '',
      totalLinesAdded: 0,
      totalLinesWasted: (r.linesWasted as number) || 0,
      wasteRate: typeof r.wasteRate === 'string' ? parseFloat(r.wasteRate) / 100 : (r.wasteRate as number) || 0,
      netEffectiveLines: 0,
      wasteScore: (r.wasteScore as number) || 0,
      patternCounts: {},
      topPattern: (r.topPattern as string) || '',
      passiveWasteLines: (r.passiveWasteLines as number) || 0,
    }
    console.log(`${TAG} [parseAgentOutput]   rank[${i}]: ${score.authorName} (${score.authorEmail}) score=${score.wasteScore} rate=${score.wasteRate}`)
    return score
  })

  // 补充 ranking 的 patternCounts
  for (const score of ranking) {
    const authorEvents = events.filter((e) => e.authorEmail === score.authorEmail)
    const counts: Record<string, number> = {}
    for (const e of authorEvents) {
      counts[e.patternId] = (counts[e.patternId] || 0) + 1
    }
    score.patternCounts = counts
  }

  const durationMs = performance.now() - startTime

  // 从数据库获取仓库名称
  const repoName = repoPath.split('/').pop() || repoPath

  const teamRecs = (parsed.teamRecommendations as string[]) || []
  console.log(`${TAG} [parseAgentOutput] teamRecommendations: ${teamRecs.length} 条`)

  return {
    analysisId,
    generatedAt: Date.now(),
    repoName,
    summary: (parsed.summary as string) || '分析完成',
    ranking,
    events,
    topIncidents: events.filter((e) => e.severity === 'high').slice(0, 5),
    teamRecommendations: teamRecs,
    analysisStats: {
      filesAnalyzed: new Set(events.flatMap((e) => e.filePaths)).size,
      commitsScanned: new Set(events.flatMap((e) => e.commitHashes)).size,
      tokensUsed: 0, // TODO: track from agent
      durationMs,
    },
  }
}

/**
 * 保存报告到数据库
 */
function saveReportToDB(db: GitPulseDB, report: WasteReport): void {
  console.log(`${TAG} [saveReportToDB] 开始保存...`)
  try {
    // 保存分析任务记录
    console.log(`${TAG} [saveReportToDB] 保存 waste_analysis_runs...`)
    db.run(
      `INSERT OR REPLACE INTO waste_analysis_runs
       (id, status, started_at, completed_at, files_analyzed, events_found, agent_model, total_tokens, report_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report.analysisId, 'completed', report.generatedAt - report.analysisStats.durationMs,
        report.generatedAt, report.analysisStats.filesAnalyzed,
        report.events.length, '', report.analysisStats.tokensUsed,
        JSON.stringify(report),
      ],
    )
    console.log(`${TAG} [saveReportToDB] waste_analysis_runs 保存成功`)

    // 保存 waste_events
    console.log(`${TAG} [saveReportToDB] 保存 ${report.events.length} 个 waste_events...`)
    for (const event of report.events) {
      db.run(
        `INSERT INTO waste_events
         (pattern_id, severity, author_email, related_authors, file_paths, commit_hashes,
          lines_wasted, was_passive, description, evidence, root_cause, recommendation,
          detected_at, analysis_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.patternId, event.severity, event.authorEmail,
          JSON.stringify(event.relatedAuthors), JSON.stringify(event.filePaths),
          JSON.stringify(event.commitHashes), event.linesWasted,
          event.wasPassive ? 1 : 0, event.description, event.evidence,
          event.rootCause, event.recommendation, event.detectedAt,
          report.analysisId,
        ],
      )
    }
    console.log(`${TAG} [saveReportToDB] waste_events 保存成功`)

    // 保存/更新 waste_scores
    console.log(`${TAG} [saveReportToDB] 保存 ${report.ranking.length} 个 waste_scores...`)
    for (const score of report.ranking) {
      db.run(
        `INSERT OR REPLACE INTO waste_scores
         (author_email, author_name, total_lines_added, total_lines_wasted, waste_rate,
          net_effective_lines, waste_score, pattern_counts, top_pattern,
          passive_waste_lines, last_updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          score.authorEmail, score.authorName, score.totalLinesAdded,
          score.totalLinesWasted, score.wasteRate, score.netEffectiveLines,
          score.wasteScore, JSON.stringify(score.patternCounts),
          score.topPattern, score.passiveWasteLines, Date.now(),
        ],
      )
    }
    console.log(`${TAG} [saveReportToDB] waste_scores 保存成功`)
    console.log(`${TAG} [saveReportToDB] 全部保存完成`)
  } catch (err) {
    console.error(`${TAG} [saveReportToDB] 保存失败:`, err)
  }
}
