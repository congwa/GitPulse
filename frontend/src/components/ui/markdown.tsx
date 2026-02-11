/**
 * Markdown 渲染组件
 *
 * 用于渲染 AI 对话中的 Markdown 内容
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface MarkdownProps {
  children: string
  className?: string
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn('prose prose-sm max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // 自定义标题样式
        h1: ({ children }) => (
          <h1 className="text-lg font-bold text-text mt-4 mb-2 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold text-text mt-3 mb-2 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-bold text-text mt-2 mb-1 first:mt-0">{children}</h3>
        ),
        // 段落
        p: ({ children }) => (
          <p className="text-sm leading-relaxed text-text mb-2 last:mb-0">{children}</p>
        ),
        // 列表
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-1 mb-2 text-sm text-text">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1 mb-2 text-sm text-text">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-sm leading-relaxed">{children}</li>
        ),
        // 代码
        code: ({ children, className }) => {
          const isInline = !className
          if (isInline) {
            return (
              <code className="px-1.5 py-0.5 rounded bg-background text-primary text-xs font-mono">
                {children}
              </code>
            )
          }
          return (
            <code className={cn('block', className)}>
              {children}
            </code>
          )
        },
        pre: ({ children }) => (
          <pre className="bg-background rounded-lg p-3 overflow-x-auto text-xs font-mono mb-2">
            {children}
          </pre>
        ),
        // 引用
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary pl-3 italic text-text-secondary text-sm mb-2">
            {children}
          </blockquote>
        ),
        // 链接
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {children}
          </a>
        ),
        // 表格
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2">
            <table className="min-w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-surface-hover">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="border border-border px-3 py-1.5 text-left font-semibold text-text">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border px-3 py-1.5 text-text-secondary">{children}</td>
        ),
        // 分隔线
        hr: () => <hr className="border-border my-3" />,
        // 强调
        strong: ({ children }) => (
          <strong className="font-semibold text-text">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
      }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
