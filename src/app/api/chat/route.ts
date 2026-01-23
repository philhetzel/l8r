import { NextRequest } from 'next/server'
import { openai, logger, updateSpan } from '@/lib/braintrust'
import { chatbotTools, executeTool, systemPrompt, ToolName } from '@/lib/chatbot'
import {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions'

export const runtime = 'nodejs'
export const maxDuration = 60

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: ChatCompletionMessageToolCall[]
  tool_call_id?: string
}

interface ChatRequestBody {
  messages: ChatMessage[]
  sessionId?: string
  parentSpanId?: string // For distributed tracing - links turns in same conversation
}

// Accumulator type for building tool calls during streaming
interface ToolCallAccumulator {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, sessionId, parentSpanId } = body as ChatRequestBody

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const turnNumber = messages.filter(m => m.role === 'user').length
    const isFirstTurn = !parentSpanId

    // Distributed tracing for multi-turn conversations:
    // - First turn: Create a "conversation" root span, then a child "chat_turn_1" span
    // - Subsequent turns: Create "chat_turn_N" as children of the conversation span
    // This creates a flat structure: conversation -> [turn_1, turn_2, turn_3, ...]
    //
    // The conversation span is updated with:
    // - input: Full message history
    // - output: Latest assistant response
    // On first turn, we update the conversation span directly.
    // On subsequent turns, we log to a "conversation_state" span since we can't
    // reopen the original conversation span across HTTP requests.

    // For first turn, we create the conversation span and keep it open
    // For subsequent turns, we already have the conversation span ID
    let conversationSpanId: string
    let conversationSpan: ReturnType<typeof logger.startSpan> | null = null

    if (isFirstTurn) {
      // Create the conversation root span - keep it open to update later
      // We'll log the full input (including tool calls) after processing completes
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

    // Start a Braintrust span for this conversation turn
    return await logger.traced(
      async (span) => {
        span.log({
          input: messages[messages.length - 1]?.content,
          metadata: {
            sessionId,
            turnNumber,
          },
        })

        // Build conversation with system prompt
        const conversationMessages: ChatCompletionMessageParam[] = [
          { role: 'system', content: systemPrompt },
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

        // Create streaming response
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          async start(controller) {
            // Send conversation span ID to client for distributed tracing
            // All subsequent turns will be children of this conversation span
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'span_id', spanId: conversationSpanId })}\n\n`
              )
            )

            const currentMessages = [...conversationMessages]
            let continueLoop = true

            while (continueLoop) {
              const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: currentMessages,
                tools: chatbotTools,
                tool_choice: 'auto',
                stream: true,
                stream_options: { include_usage: true },
              })

              let assistantContent = ''
              const toolCalls: ToolCallAccumulator[] = []
              let currentToolCall: ToolCallAccumulator | null = null

              for await (const chunk of response) {
                const delta = chunk.choices[0]?.delta

                // Handle content streaming
                if (delta?.content) {
                  assistantContent += delta.content
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'content', content: delta.content })}\n\n`
                    )
                  )
                }

                // Handle tool calls
                if (delta?.tool_calls) {
                  for (const toolCallDelta of delta.tool_calls) {
                    if (toolCallDelta.index !== undefined) {
                      if (!toolCalls[toolCallDelta.index]) {
                        toolCalls[toolCallDelta.index] = {
                          id: '',
                          type: 'function',
                          function: { name: '', arguments: '' },
                        }
                      }
                      currentToolCall = toolCalls[toolCallDelta.index]
                    }

                    if (currentToolCall) {
                      if (toolCallDelta.id) {
                        currentToolCall.id = toolCallDelta.id
                      }
                      if (toolCallDelta.function?.name) {
                        currentToolCall.function.name = toolCallDelta.function.name
                      }
                      if (toolCallDelta.function?.arguments) {
                        currentToolCall.function.arguments += toolCallDelta.function.arguments
                      }
                    }
                  }
                }
              }

              // If there are tool calls, execute them
              if (toolCalls.length > 0) {
                // Send tool call info to client
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'tool_calls',
                      tool_calls: toolCalls.map((tc) => ({
                        id: tc.id,
                        name: tc.function.name,
                        arguments: tc.function.arguments,
                      })),
                    })}\n\n`
                  )
                )

                // Add assistant message with tool calls
                currentMessages.push({
                  role: 'assistant',
                  content: assistantContent || null,
                  tool_calls: toolCalls,
                })

                // Execute each tool call
                for (const toolCall of toolCalls) {
                  const toolName = toolCall.function.name as ToolName
                  let parameters: Record<string, unknown> = {}

                  try {
                    parameters = JSON.parse(toolCall.function.arguments || '{}')
                  } catch {
                    parameters = {}
                  }

                  // Send tool execution start
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: 'tool_start',
                        tool: toolName,
                        tool_call_id: toolCall.id,
                      })}\n\n`
                    )
                  )

                  // Execute the tool
                  const { result, error } = await executeTool(toolName, parameters)

                  // Send tool result
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: 'tool_result',
                        tool: toolName,
                        tool_call_id: toolCall.id,
                        result: error ? { error } : result,
                      })}\n\n`
                    )
                  )

                  // Add tool result to messages
                  currentMessages.push({
                    role: 'tool',
                    content: JSON.stringify(error ? { error } : result),
                    tool_call_id: toolCall.id,
                  })
                }

                // Continue the loop to get the assistant's response to tool results
              } else {
                // No tool calls, we're done
                continueLoop = false

                // Add final assistant message to the conversation
                currentMessages.push({
                  role: 'assistant',
                  content: assistantContent,
                })

                // Build complete conversation history (excluding system prompt)
                // This includes all messages, tool calls, and tool results from this turn
                const fullConversationHistory = currentMessages.slice(1) // Remove system prompt

                // Log the final output to the turn span
                span.log({
                  output: assistantContent,
                  metadata: {
                    toolCallsCount: toolCalls.length,
                    turnNumber,
                  },
                })

                // Update conversation span with full history including tool calls
                if (isFirstTurn && conversationSpan) {
                  // On first turn, update the conversation span we created
                  conversationSpan.log({
                    input: fullConversationHistory,
                    output: assistantContent,
                    metadata: {
                      turnNumber,
                      messagesCount: fullConversationHistory.length,
                    },
                  })
                  conversationSpan.end()
                } else {
                  // On subsequent turns, use updateSpan to update the root conversation span
                  // This overwrites the input/output with the latest conversation state
                  updateSpan({
                    exported: conversationSpanId,
                    input: fullConversationHistory,
                    output: assistantContent,
                    metadata: {
                      turnNumber,
                      messagesCount: fullConversationHistory.length,
                    },
                  })
                }
              }
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      },
      turnSpanOptions
    )
  } catch (error) {
    console.error('Chat API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request',
        message: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
