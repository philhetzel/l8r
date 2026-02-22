import { openai } from '../braintrust'
import { chatbotTools, ToolName } from './tools'
import { executeTool } from './tool-executor'
import { getSystemPrompt } from './system-prompt'
import {
  ChatCompletionMessageParam,
  ChatCompletionMessageFunctionToolCall,
} from 'openai/resources/chat/completions'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: ChatCompletionMessageFunctionToolCall[]
  tool_call_id?: string
}

export interface ChatOptions {
  instructions?: string
}

export interface ChatResult {
  content: string
  messages: ChatCompletionMessageParam[]
}

/**
 * Normalize various input formats into a clean ChatMessage array.
 * Handles: arrays, strings, { messages: [] }, { input: "" }, { '0': msg, '1': msg }
 * Validates tool message ordering (removes orphaned tool messages).
 */
export function normalizeMessages(input: unknown): ChatMessage[] {
  if (input === undefined || input === null) {
    throw new Error('Input cannot be undefined or null')
  }

  // Determine raw messages from various input formats
  let rawMessages: unknown[]

  if (Array.isArray(input)) {
    rawMessages = input
  } else if (typeof input === 'string') {
    return [{ role: 'user', content: input }]
  } else if (typeof input === 'object') {
    const obj = input as Record<string, unknown>
    if (obj.messages && Array.isArray(obj.messages)) {
      rawMessages = obj.messages
    } else if (obj['0'] !== undefined) {
      // Handle { '0': msg, '1': msg } format
      rawMessages = Object.values(obj)
    } else if (obj.input) {
      return Array.isArray(obj.input)
        ? normalizeMessages(obj.input)
        : [{ role: 'user', content: String(obj.input) }]
    } else if (obj.content) {
      return [{ role: (obj.role as 'user' | 'assistant') || 'user', content: String(obj.content) }]
    } else {
      return [{ role: 'user', content: JSON.stringify(input) }]
    }
  } else {
    return [{ role: 'user', content: JSON.stringify(input) }]
  }

  // Transform and validate tool message ordering
  const messages: ChatMessage[] = []
  let pendingToolCallIds = new Set<string>()

  for (const m of rawMessages) {
    const msg = m as Record<string, unknown>
    const role = msg.role as string

    if (role === 'tool') {
      // Skip orphaned tool messages
      if (!pendingToolCallIds.has(msg.tool_call_id as string)) {
        continue
      }
      pendingToolCallIds.delete(msg.tool_call_id as string)
      messages.push({
        role: 'tool',
        content: String(msg.content),
        tool_call_id: msg.tool_call_id as string,
      })
    } else if (role === 'assistant') {
      const toolCalls = msg.tool_calls as ChatCompletionMessageFunctionToolCall[] | undefined
      if (toolCalls?.length) {
        // Clear any pending tool calls from previous assistant message
        if (pendingToolCallIds.size > 0 && messages.length > 0) {
          const lastMsg = messages[messages.length - 1]
          if (lastMsg.role === 'assistant' && lastMsg.tool_calls) {
            messages.pop()
          }
        }
        pendingToolCallIds = new Set(toolCalls.map((tc) => tc.id))
        messages.push({
          role: 'assistant',
          content: String(msg.content || ''),
          tool_calls: toolCalls,
        })
      } else {
        // Regular assistant message - clear pending state
        if (pendingToolCallIds.size > 0 && messages.length > 0) {
          const lastMsg = messages[messages.length - 1]
          if (lastMsg.role === 'assistant' && lastMsg.tool_calls) {
            messages.pop()
          }
        }
        pendingToolCallIds = new Set()
        messages.push({ role: 'assistant', content: String(msg.content) })
      }
    } else {
      // User or system message - clear pending state
      if (pendingToolCallIds.size > 0 && messages.length > 0) {
        const lastMsg = messages[messages.length - 1]
        if (lastMsg.role === 'assistant' && lastMsg.tool_calls) {
          messages.pop()
        }
      }
      pendingToolCallIds = new Set()
      messages.push({ role: role as 'user' | 'system', content: String(msg.content) })
    }
  }

  // Remove trailing assistant message with unanswered tool_calls
  if (messages.length > 0 && pendingToolCallIds.size > 0) {
    const lastMsg = messages[messages.length - 1]
    if (lastMsg.role === 'assistant' && lastMsg.tool_calls) {
      messages.pop()
    }
  }

  return messages
}

/**
 * Pure chat function - no span management.
 * LLM calls are auto-traced via wrapOpenAI.
 * Tool calls are auto-traced via wrapTracedTool.
 * Callers are responsible for span management if needed.
 */
export async function chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
  const instructions = options.instructions || (await getSystemPrompt())

  const conversationMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: instructions },
    ...messages.map((m) => {
      if (m.role === 'tool') {
        return { role: 'tool' as const, content: m.content, tool_call_id: m.tool_call_id! }
      }
      if (m.tool_calls) {
        return { role: 'assistant' as const, content: m.content || null, tool_calls: m.tool_calls }
      }
      return { role: m.role as 'user' | 'assistant', content: m.content }
    }),
  ]

  let assistantContent = ''
  let continueLoop = true

  while (continueLoop) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: conversationMessages,
      tools: chatbotTools,
      tool_choice: 'auto',
    })

    const message = response.choices[0]?.message
    assistantContent = message?.content || ''
    // Filter to only function tool calls (type: 'function')
    const toolCalls = (message?.tool_calls || []).filter(
      (tc): tc is ChatCompletionMessageFunctionToolCall => tc.type === 'function'
    )

    if (toolCalls.length > 0) {
      conversationMessages.push({
        role: 'assistant',
        content: assistantContent || null,
        tool_calls: toolCalls,
      })

      for (const tc of toolCalls) {
        const { result, error } = await executeTool(
          tc.function.name as ToolName,
          JSON.parse(tc.function.arguments || '{}')
        )
        conversationMessages.push({
          role: 'tool',
          content: JSON.stringify(error ? { error } : result),
          tool_call_id: tc.id,
        })
      }
    } else {
      continueLoop = false
      conversationMessages.push({ role: 'assistant', content: assistantContent })
    }
  }

  return {
    content: assistantContent,
    messages: conversationMessages.slice(1), // Exclude system prompt
  }
}
