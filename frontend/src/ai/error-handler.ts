/**
 * GitPulse AI 错误处理
 */

export type AIErrorCode =
  | 'NO_API_KEY'
  | 'INVALID_KEY'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'MODEL_NOT_FOUND'
  | 'CONTEXT_LENGTH'
  | 'INSUFFICIENT_BALANCE'
  | 'UNKNOWN'

export class AIError extends Error {
  constructor(
    message: string,
    public code: AIErrorCode,
    public retryable: boolean = false,
  ) {
    super(message)
    this.name = 'AIError'
  }
}

/**
 * 统一错误处理：把各种 AI API 错误转换为用户友好的 AIError
 */
export function handleAIError(error: unknown): AIError {
  if (error instanceof AIError) return error

  const msg = String(error)

  // API Key 问题
  if (msg.includes('请先') && msg.includes('API Key')) {
    return new AIError('请先在设置中配置 AI API Key', 'NO_API_KEY')
  }
  if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('invalid_api_key')) {
    return new AIError('API Key 无效或已过期，请在设置中重新配置', 'INVALID_KEY')
  }

  // 余额不足
  if (msg.includes('balance') || msg.includes('insufficient') || msg.includes('余额') || msg.includes('30001')) {
    return new AIError('AI 账户余额不足，请充值后重试', 'INSUFFICIENT_BALANCE')
  }

  // 频率限制
  if (msg.includes('429') || msg.includes('rate') || msg.includes('Rate limit')) {
    return new AIError('请求频率超限，请稍后再试', 'RATE_LIMIT', true)
  }

  // 网络问题
  if (msg.includes('timeout') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('network')) {
    return new AIError('AI 服务连接超时，请检查网络或 Base URL 配置', 'NETWORK', true)
  }

  // 模型不存在
  if (msg.includes('model_not_found') || msg.includes('does not exist')) {
    return new AIError('指定的模型不存在，请在设置中检查模型名称', 'MODEL_NOT_FOUND')
  }

  // Token 超限
  if (msg.includes('context_length') || msg.includes('maximum context length') || msg.includes('token')) {
    return new AIError('输入内容过长，已超出模型的上下文长度限制', 'CONTEXT_LENGTH')
  }

  return new AIError(`AI 调用失败: ${msg.slice(0, 200)}`, 'UNKNOWN')
}
