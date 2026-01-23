import { Eval, initDataset } from "braintrust";
import { Faithfulness, LLMClassifierFromTemplate } from "autoevals";
import * as dotenv from "dotenv";
import { z } from "zod";
import { chat, ChatMessage } from "../src/lib/chatbot";

dotenv.config();

const projectName = process.env.BRAINTRUST_PROJECT_NAME || "l8r-customer-service";

// Default system instructions for the customer service agent
const defaultInstructions = `
You are a helpful customer service assistant for l8r, a Buy Now Pay Later service.
You help customers with their account balance, orders, payment plans, and refund requests.
Always be polite, accurate, and helpful.
`;

async function task(input: any, hooks: any) {
  // Guard against undefined/null input
  if (input === undefined || input === null) {
    throw new Error("Task received undefined or null input");
  }

  // Build messages from input - handle various dataset formats
  let rawMessages: any[];

  if (input.messages && Array.isArray(input.messages)) {
    rawMessages = input.messages;
  } else if (Array.isArray(input)) {
    rawMessages = input;
  } else if (typeof input === "object" && input["0"] !== undefined) {
    // Handle array-like objects with numeric keys (e.g., { '0': msg1, '1': msg2, ... })
    rawMessages = Object.values(input);
  } else if (typeof input === "string") {
    rawMessages = [{ role: "user", content: input }];
  } else if (input.input) {
    if (Array.isArray(input.input)) {
      rawMessages = input.input;
    } else {
      rawMessages = [{ role: "user", content: input.input }];
    }
  } else if (input.content) {
    rawMessages = [{ role: input.role || "user", content: input.content }];
  } else {
    rawMessages = [{ role: "user", content: JSON.stringify(input) }];
  }

  // Transform messages to ChatMessage format and validate tool message ordering
  const messages: ChatMessage[] = [];
  let lastAssistantHadToolCalls = false;
  let pendingToolCallIds = new Set<string>();

  for (const m of rawMessages) {
    // Skip tool messages that don't follow an assistant message with tool_calls
    if (m.role === "tool") {
      if (!lastAssistantHadToolCalls || !pendingToolCallIds.has(m.tool_call_id)) {
        console.log("[Eval] Skipping orphaned tool message (no matching tool_call)");
        continue;
      }
      pendingToolCallIds.delete(m.tool_call_id);
    }

    const msg: ChatMessage = {
      role: m.role,
      content: m.content,
    };

    // Only assistant messages can have tool_calls (not user messages)
    if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      msg.tool_calls = m.tool_calls;
      lastAssistantHadToolCalls = true;
      pendingToolCallIds = new Set(m.tool_calls.map((tc: any) => tc.id));
    } else if (m.role === "tool" && m.tool_call_id) {
      msg.tool_call_id = m.tool_call_id;
    } else if (m.role !== "tool") {
      // Reset tracking for non-tool, non-assistant-with-toolcalls messages
      if (m.role !== "assistant" || !m.tool_calls || m.tool_calls.length === 0) {
        // If there are pending tool calls that weren't answered, remove the last assistant message
        if (pendingToolCallIds.size > 0 && messages.length > 0) {
          const lastMsg = messages[messages.length - 1];
          if (lastMsg.role === "assistant" && lastMsg.tool_calls) {
            console.log("[Eval] Removing assistant message with unanswered tool_calls");
            messages.pop();
          }
        }
        lastAssistantHadToolCalls = false;
        pendingToolCallIds = new Set();
      }
    }

    messages.push(msg);
  }

  // Final check: remove trailing assistant message with unanswered tool_calls
  if (messages.length > 0 && pendingToolCallIds.size > 0) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "assistant" && lastMsg.tool_calls) {
      console.log("[Eval] Removing trailing assistant message with unanswered tool_calls");
      messages.pop();
    }
  }

  console.log("[Eval] Running with", messages.length, "messages");

  try {
    // Call the chat function directly (no HTTP overhead)
    // skipSpanManagement lets the eval framework handle tracing
    const result = await chat(messages, {
      sessionId: `eval-${Date.now()}`,
      skipSpanManagement: true,
      instructions: hooks.parameters.instructions,
    });

    // Initialize metadata if it doesn't exist
    if (!hooks.metadata) {
      hooks.metadata = {};
    }

    // Store tool call info for scorers
    hooks.metadata.eval_tool_info = result.toolCalls;
    hooks.metadata.instructions = hooks.parameters.instructions;

    return result.content;
  } catch (error) {
    console.error("[Eval] Chat error:", error);
    console.error("[Eval] Input was:", JSON.stringify(input, null, 2));
    throw error;
  }
}

// Scorer: Check if the expected tools were called
async function toolCallCheck({ expected, metadata }: any) {
  const expectedTools: string[] = metadata?.expected_tools || expected?.tools || [];
  const actualToolCalls = metadata?.eval_tool_info || [];

  if (expectedTools.length === 0) {
    return null; // Skip if no expected tools defined
  }

  const expectedToolSet = new Set<string>(expectedTools);
  const actualToolSet = new Set<string>(actualToolCalls.map((tc: any) => tc.name));

  const expectedArray = Array.from(expectedToolSet);
  const actualArray = Array.from(actualToolSet);

  const overlap = expectedArray.filter((tool) => actualToolSet.has(tool)).length;
  const score = overlap / expectedToolSet.size;

  return {
    score,
    name: "toolCallCheck",
    metadata: {
      expectedTools: expectedArray,
      actualTools: actualArray,
      overlap,
      totalExpected: expectedToolSet.size,
      totalActual: actualToolSet.size,
      missingTools: expectedArray.filter((tool) => !actualToolSet.has(tool)),
      unexpectedTools: actualArray.filter((tool) => !expectedToolSet.has(tool)),
    },
  };
}

// Scorer: Check response structure and formatting
const structureCheck = LLMClassifierFromTemplate({
  name: "StructureCheck",
  promptTemplate: `Does the response adhere to good customer service formatting? (Y/N)

A good customer service response should:
- Be clear and easy to read
- Use formatting like **bold** for important information (amounts, dates, status)
- Organize information logically
- Include relevant details from tool results
- Be professional and helpful in tone

Response to evaluate:
{{output}}`,
  choiceScores: {
    Y: 1,
    N: 0,
  },
  useCoT: true,
  model: "gpt-4o-mini",
});

// Scorer: Check helpfulness of the response
const helpfulnessCheck = LLMClassifierFromTemplate({
  name: "HelpfulnessCheck",
  promptTemplate: `Rate whether this customer service response is helpful. (Y/N)

A helpful response should:
- Directly address the customer's question or concern
- Provide actionable information or next steps
- Be accurate based on the data retrieved
- Show empathy when appropriate
- Not leave the customer with unanswered questions

Customer query: {{input}}
Response: {{output}}`,
  choiceScores: {
    Y: 1,
    N: 0,
  },
  useCoT: true,
  model: "gpt-4o-mini",
});

// Scorer: Check if response is grounded in tool results (faithfulness)
async function faithfulnessCheck({ output, input, metadata }: any) {
  const toolCalls = metadata?.eval_tool_info || [];

  // Extract context from tool results
  const contextParts: string[] = [];
  for (const tc of toolCalls) {
    if (tc.result) {
      contextParts.push(`Tool: ${tc.name}\nResult: ${JSON.stringify(tc.result, null, 2)}`);
    }
  }

  const context = contextParts.join("\n\n");

  // If no tool results, skip faithfulness check
  if (contextParts.length === 0) {
    return null;
  }

  return Faithfulness({
    input: typeof input === "string" ? input : input.input || JSON.stringify(input),
    output,
    context,
  });
}

// Scorer: Check resolution - did the agent complete the task?
const resolutionCheck = LLMClassifierFromTemplate({
  name: "ResolutionCheck",
  promptTemplate: `Did the agent successfully resolve or address the customer's request? (Y/N)

Consider:
- Was the customer's core need met?
- Did the agent take appropriate action (if action was requested)?
- Is there a clear resolution or next step?

Customer query: {{input}}
Response: {{output}}`,
  choiceScores: {
    Y: 1,
    N: 0,
  },
  useCoT: true,
  model: "gpt-4o-mini",
});

// @ts-ignore - Type inference too deep with Zod parameters (works at runtime)
Eval(projectName, {
  experimentName: `l8r-eval-${new Date().toISOString().split("T")[0]}`,
  task: async (input: any, hooks: any) => {
    // Store runtime values in test-case metadata
    hooks.metadata.actualInstructions = hooks.parameters.instructions;
    hooks.metadata.timestamp = new Date().toISOString();

    return task(input, hooks);
  },
  data: initDataset({ project: projectName, dataset: "L8rCustomerServiceDataset" }),
  scores: [toolCallCheck, structureCheck, helpfulnessCheck],
  parameters: {
    instructions: z
      .string()
      .describe("The instructions for the agent to follow")
      .default(defaultInstructions),
  },
  metadata: {},
});
