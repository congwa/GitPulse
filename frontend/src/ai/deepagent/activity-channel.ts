/**
 * 工贼检测 — 活动通道
 *
 * 轻量级 pub/sub，让 DeepAgent 的各层模块能实时上报活动事件，
 * 供 UI 层展示"后端在干活"的实时动态。
 *
 * 使用方式:
 *   - 发布端: import { emitActivity } from './activity-channel'
 *   - 订阅端: import { onActivity } from './activity-channel'
 */

export type ActivityType =
  | 'phase'         // 阶段转换（预扫描 / 深度分析 / 报告）
  | 'task-start'    // 派遣 SubAgent
  | 'task-complete' // SubAgent 完成
  | 'task-error'    // SubAgent 失败
  | 'tool-call'     // 执行 git 命令 / 读文件
  | 'info'          // 一般信息

export interface ActivityItem {
  id: number
  timestamp: number
  type: ActivityType
  message: string
  /** 补充细节（如完整命令、错误信息） */
  detail?: string
}

type Listener = (item: ActivityItem) => void

const listeners = new Set<Listener>()
let counter = 0
let analysisStartTime = 0

/** 重置通道（每次新分析开始时调用） */
export function resetActivityChannel() {
  counter = 0
  analysisStartTime = Date.now()
}

/** 获取分析开始时间戳 */
export function getAnalysisStartTime() {
  return analysisStartTime
}

/** 发布一条活动 */
export function emitActivity(
  type: ActivityType,
  message: string,
  detail?: string,
) {
  const item: ActivityItem = {
    id: ++counter,
    timestamp: Date.now(),
    type,
    message,
    detail,
  }
  listeners.forEach((fn) => fn(item))
}

/** 订阅活动流，返回取消订阅函数 */
export function onActivity(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
