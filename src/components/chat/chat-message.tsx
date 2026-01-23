'use client'

import * as React from 'react'
import { Bot, Wrench } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: {
    id: string
    name: string
    arguments: string
    result?: unknown
  }[]
  isStreaming?: boolean
}

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex gap-3 animate-slide-up',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {isUser ? (
          <Avatar fallback="AJ" size="sm" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
            <Bot className="h-4 w-4 text-primary" />
          </div>
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          'flex flex-col max-w-[80%] gap-2',
          isUser ? 'items-end' : 'items-start'
        )}
      >
        {/* Tool Calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-2 w-full">
            {message.toolCalls.map((tool) => (
              <ToolCallDisplay key={tool.id} toolCall={tool} />
            ))}
          </div>
        )}

        {/* Text Content */}
        {message.content && (
          <div
            className={cn(
              'rounded-2xl px-4 py-2',
              isUser
                ? 'bg-primary text-black'
                : 'bg-muted text-foreground'
            )}
          >
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            ) : (
              <div className="text-sm prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-pre:my-2 prose-code:bg-black/20 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolCallDisplay({
  toolCall,
}: {
  toolCall: { id: string; name: string; arguments: string; result?: unknown }
}) {
  const [expanded, setExpanded] = React.useState(false)

  const toolDisplayNames: Record<string, string> = {
    get_account_balance: 'Checking account balance',
    get_orders: 'Looking up orders',
    get_order_details: 'Getting order details',
    get_installment_plans: 'Checking payment plans',
    get_plan_details: 'Getting plan details',
    get_payment_history: 'Checking payment history',
    get_payment_details: 'Getting payment details',
    retry_payment: 'Retrying payment',
    modify_plan: 'Modifying payment plan',
    request_refund: 'Processing refund request',
  }

  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
      >
        <Wrench className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">
          {toolDisplayNames[toolCall.name] || toolCall.name}
        </span>
        {toolCall.result !== undefined && (
          <span className="text-xs text-green-500 ml-auto">Done</span>
        )}
        {toolCall.result === undefined && (
          <span className="text-xs text-muted-foreground ml-auto animate-pulse">
            Processing...
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3 py-2 border-t border-border text-xs">
          <p className="text-muted-foreground mb-1">Parameters:</p>
          <pre className="bg-muted p-2 rounded overflow-x-auto">
            {JSON.stringify(JSON.parse(toolCall.arguments || '{}'), null, 2)}
          </pre>
          {toolCall.result !== undefined && (
            <>
              <p className="text-muted-foreground mt-2 mb-1">Result:</p>
              <pre className="bg-muted p-2 rounded overflow-x-auto max-h-32">
                {JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex items-center gap-1 bg-muted rounded-2xl px-4 py-2">
        <div className="typing-indicator flex gap-1">
          <span className="w-2 h-2 rounded-full bg-muted-foreground" />
          <span className="w-2 h-2 rounded-full bg-muted-foreground" />
          <span className="w-2 h-2 rounded-full bg-muted-foreground" />
        </div>
      </div>
    </div>
  )
}
