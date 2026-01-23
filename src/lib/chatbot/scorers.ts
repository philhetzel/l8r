import { wrapTraced } from '@/lib/braintrust'

// Sentiment scorer - analyzes customer sentiment
export const scoreSentiment = wrapTraced(async function score_sentiment(
  userMessage: string,
  assistantResponse: string
) {
  // Simple keyword-based sentiment for demo
  // In production, use a proper sentiment model
  const positiveWords = ['thanks', 'great', 'helpful', 'awesome', 'perfect', 'excellent']
  const negativeWords = ['frustrated', 'angry', 'terrible', 'awful', 'worst', 'hate']

  const combined = `${userMessage} ${assistantResponse}`.toLowerCase()

  let score = 0.5 // neutral

  for (const word of positiveWords) {
    if (combined.includes(word)) score += 0.1
  }

  for (const word of negativeWords) {
    if (combined.includes(word)) score -= 0.1
  }

  return {
    name: 'sentiment',
    score: Math.max(0, Math.min(1, score)),
    metadata: {
      userMessage,
      assistantResponse: assistantResponse.substring(0, 200),
    },
  }
})

// Helpfulness scorer - evaluates if the response addressed the user's query
export const scoreHelpfulness = wrapTraced(async function score_helpfulness(
  userMessage: string,
  assistantResponse: string,
  toolsUsed: string[]
) {
  let score = 0.5

  // Reward for using tools (indicates looking up actual data)
  if (toolsUsed.length > 0) score += 0.2

  // Reward for longer, more detailed responses
  if (assistantResponse.length > 100) score += 0.1
  if (assistantResponse.length > 300) score += 0.1

  // Reward for including specific data (amounts, dates)
  if (/\$[\d,]+\.?\d*/.test(assistantResponse)) score += 0.1
  if (/\d{1,2}\/\d{1,2}\/\d{4}|\w+ \d{1,2}, \d{4}/.test(assistantResponse)) score += 0.05

  return {
    name: 'helpfulness',
    score: Math.max(0, Math.min(1, score)),
    metadata: {
      toolsUsed,
      responseLength: assistantResponse.length,
    },
  }
})

// Resolution scorer - tracks if the issue was resolved
export const scoreResolution = wrapTraced(async function score_resolution(
  userMessage: string,
  assistantResponse: string,
  toolsUsed: string[]
) {
  let score = 0.3 // base score

  // Action-oriented tools indicate resolution
  const actionTools = ['retry_payment', 'modify_plan', 'request_refund']
  const usedActionTools = toolsUsed.filter(t => actionTools.includes(t))

  if (usedActionTools.length > 0) score += 0.4

  // Success language in response
  const successIndicators = ['successful', 'completed', 'processed', 'submitted', 'done']
  for (const indicator of successIndicators) {
    if (assistantResponse.toLowerCase().includes(indicator)) {
      score += 0.15
      break
    }
  }

  return {
    name: 'resolution',
    score: Math.max(0, Math.min(1, score)),
    metadata: {
      usedActionTools,
    },
  }
})

// Combined scorer for logging all scores
export async function scoreConversation(
  userMessage: string,
  assistantResponse: string,
  toolsUsed: string[]
) {
  const [sentiment, helpfulness, resolution] = await Promise.all([
    scoreSentiment(userMessage, assistantResponse),
    scoreHelpfulness(userMessage, assistantResponse, toolsUsed),
    scoreResolution(userMessage, assistantResponse, toolsUsed),
  ])

  return {
    sentiment,
    helpfulness,
    resolution,
    overall: (sentiment.score + helpfulness.score + resolution.score) / 3,
  }
}
