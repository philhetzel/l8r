import { openai, logger, updateSpan } from '../braintrust'
import { chatbotTools, ToolName } from './tools'
import { executeTool } from './tool-executor'
import { systemPrompt } from './system-prompt'
import {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: ChatCompletionMessageToolCall[]
  tool_call_id?: string
}

export interface ChatOptions {
  sessionId?: string
  parentSpanId?: string
  /** Skip conversation span management (for evals where the framework handles tracing) */
  skipSpanManagement?: boolean
  /** Custom instructions/system prompt (defaults to systemPrompt) */
  instructions?: string
}

export interface ToolCallInfo {
  id: string
  name: string
  arguments: string
  result?: unknown
}

export interface ChatResult {
  content: string
  toolCalls: ToolCallInfo[]
  conversationSpanId?: string
  messages: ChatCompletionMessageParam[]
}

/**
 * Core chat logic without span management.
 * LLM calls are auto-traced via wrapOpenAI.
 * Tool calls are auto-traced via wrapTracedTool.
 */
async function chatCore(messages: ChatMessage[], instructions?: string): Promise<ChatResult> {
  // Build conversation with system prompt (use custom instructions if provided)
  const conversationMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: instructions || systemPrompt },
    ...messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          content: m.content,
          tool_call_id: m.tool_call_id!,
        }
      }
      if (m.tool_calls) {
        return {
          role: 'assistant' as const,
          content: m.content || null,
          tool_calls: m.tool_calls,
        }
      }
      return {
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }
    }),
  ]

  const currentMessages = [...conversationMessages]
  let assistantContent = ''
  const allToolCalls: ToolCallInfo[] = []
  let continueLoop = true

  while (continueLoop) {
    // LLM call - auto-traced via wrapOpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: currentMessages,
      tools: chatbotTools,
      tool_choice: 'auto',
    })

    const message = response.choices[0]?.message
    assistantContent = message?.content || ''
    const toolCalls = message?.tool_calls || []

    if (toolCalls.length > 0) {
      // Add assistant message with tool calls
      currentMessages.push({
        role: 'assistant',
        content: assistantContent || null,
        tool_calls: toolCalls,
      })

      // Execute each tool call - auto-traced via wrapTracedTool
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name as ToolName
        let parameters: Record<string, unknown> = {}

        try {
          parameters = JSON.parse(toolCall.function.arguments || '{}')
        } catch {
          parameters = {}
        }

        const { result, error } = await executeTool(toolName, parameters)
        const toolResult = error ? { error } : result

        allToolCalls.push({
          id: toolCall.id,
          name: toolName,
          arguments: toolCall.function.arguments,
          result: toolResult,
        })

        currentMessages.push({
          role: 'tool',
          content: JSON.stringify(toolResult),
          tool_call_id: toolCall.id,
        })
      }
    } else {
      continueLoop = false

      currentMessages.push({
        role: 'assistant',
        content: assistantContent,
      })
    }
  }

  // Build complete conversation history (excluding system prompt)
  const fullConversationHistory = currentMessages.slice(1)

  return {
    content: assistantContent,
    toolCalls: allToolCalls,
    messages: fullConversationHistory,
  }
}

/**
 * Chat function with full conversation span management.
 * Used by the API route for distributed tracing across turns.
 * For evals, use skipSpanManagement: true to let the eval framework handle tracing.
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ChatResult> {
  const { sessionId, parentSpanId, skipSpanManagement } = options

  // For evals or when span management is skipped, just run the core chat logic
  if (skipSpanManagement) {
    return chatCore(messages, options.instructions)
  }

  const turnNumber = messages.filter((m) => m.role === 'user').length
  const isFirstTurn = !parentSpanId

  // Distributed tracing for multi-turn conversations
  let conversationSpanId: string
  let conversationSpan: ReturnType<typeof logger.startSpan> | null = null

  if (isFirstTurn) {
    conversationSpan = logger.startSpan({ name: 'conversation' })
    conversationSpan.log({
      metadata: {
        sessionId,
        type: 'multi_turn_conversation',
      },
    })
    conversationSpanId = await conversationSpan.export()
  } else {
    conversationSpanId = parentSpanId
  }

  // Create the turn span as a child of the conversation
  const turnSpanOptions = {
    name: `chat_turn_${turnNumber}`,
    parent: conversationSpanId,
  }

  return await logger.traced(
    async (span) => {
      span.log({
        input: messages[messages.length - 1]?.content,
        metadata: {
          sessionId,
          turnNumber,
        },
      })

      // Run the core chat logic
      const result = await chatCore(messages, options.instructions)

      // Log the final output to the turn span
      span.log({
        output: result.content,
        metadata: {
          toolCallsCount: result.toolCalls.length,
          turnNumber,
        },
      })

      // Update conversation span with full history including tool calls
      if (isFirstTurn && conversationSpan) {
        conversationSpan.log({
          input: result.messages,
          output: result.content,
          metadata: {
            turnNumber,
            messagesCount: result.messages.length,
          },
        })
        conversationSpan.end()
      } else {
        updateSpan({
          exported: conversationSpanId,
          input: result.messages,
          output: result.content,
          metadata: {
            turnNumber,
            messagesCount: result.messages.length,
          },
        })
      }

      return {
        ...result,
        conversationSpanId,
      }
    },
    turnSpanOptions
  )
}
