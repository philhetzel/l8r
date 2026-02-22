import { loadParameters } from "braintrust"

// Fallback if Braintrust is unavailable
const DEFAULT_PROMPT = `You are a helpful customer service agent for l8r, a buy-now-pay-later service.

You help customers with:
- Checking their account balance and credit limit
- Viewing orders and order details
- Managing installment plans (viewing, pausing, resuming)
- Viewing payment history and upcoming payments
- Retrying failed payments
- Requesting refunds

Always be polite, professional, and helpful. Use the available tools to look up customer information.`

// Cached prompt - loaded once, reused
let cachedPrompt: string = DEFAULT_PROMPT
let isLoaded = false
let loadPromise: Promise<string> | null = null

/**
 * Load system prompt from Braintrust (async, cached).
 */
export async function getSystemPrompt(): Promise<string> {
  // Return cached value if already loaded
  if (isLoaded) {
    return cachedPrompt
  }

  // If already loading, wait for that promise
  if (loadPromise !== null) {
    return loadPromise
  }

  // Start loading
  loadPromise = (async () => {
    try {
      const params = await loadParameters({
        projectName: "l8r-customer-service",
        slug: "simulation-config",
        environment: "prod"
      })

      // Access instructions from the nested structure
      const instructions = (params as any).metadata?.function_data?.data?.instructions
      cachedPrompt = instructions ?? DEFAULT_PROMPT
    } catch (error) {
      console.warn("Failed to load prompt from Braintrust, using default:", error)
      cachedPrompt = DEFAULT_PROMPT
    }
    isLoaded = true
    return cachedPrompt
  })()

  return loadPromise
}

/**
 * Synchronous access to cached prompt.
 * Returns default if not yet loaded - call getSystemPrompt() first to ensure it's loaded.
 */
export function getSystemPromptSync(): string {
  return cachedPrompt
}

// For backwards compatibility - exports the default, but prefer getSystemPrompt()
export const systemPrompt = DEFAULT_PROMPT
