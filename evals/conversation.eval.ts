import { Eval, initDataset } from "braintrust";
import { LLMClassifierFromTemplate, Faithfulness } from "autoevals";
import * as dotenv from "dotenv";
import { z } from "zod";
import { chat, normalizeMessages } from "../src/lib/chatbot";
import { systemPrompt } from "../src/lib/chatbot";

dotenv.config();

const projectName = process.env.BRAINTRUST_PROJECT_NAME || "l8r-customer-service";

const defaultInstructions = systemPrompt;

async function task(input: any, hooks: any) {
  const messages = normalizeMessages(input);
  const result = await chat(messages, { instructions: hooks.parameters.instructions });
  return result.content;
}

// Scorer: Check if the expected tools were called
async function toolCallCheck({ expected, metadata, trace }: any) {
  const expectedTools: string[] = metadata?.expected_tools || expected?.tools || [];
  if (expectedTools.length === 0) return null;

  const toolSpans = await trace.getSpans({ spanType: ["tool"] });
  const actualToolSet = new Set<string>(
    toolSpans.map((span: any) => span.span_attributes?.name || span.metadata?.name)
  );

  const expectedToolSet = new Set<string>(expectedTools);
  const expectedArray = Array.from(expectedToolSet);
  const actualArray = Array.from(actualToolSet);
  const overlap = expectedArray.filter((tool) => actualToolSet.has(tool)).length;

  return {
    score: overlap / expectedToolSet.size,
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
  choiceScores: { Y: 1, N: 0 },
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
  choiceScores: { Y: 1, N: 0 },
  useCoT: true,
  model: "gpt-4o-mini",
});

// Scorer: Check if response is grounded in tool results (faithfulness)
async function faithfulnessCheck({ output, input, trace }: any) {
  const toolSpans = await trace.getSpans({ spanType: ["tool"] });
  const contextParts: string[] = [];

  for (const span of toolSpans) {
    const toolName = span.span_attributes?.name || span.metadata?.name || "Tool";
    if (span.output) {
      contextParts.push(`Tool: ${toolName}\nResult: ${JSON.stringify(span.output, null, 2)}`);
    }
  }

  if (contextParts.length === 0) return null;

  return Faithfulness({
    input: typeof input === "string" ? input : input.input || JSON.stringify(input),
    output,
    context: contextParts.join("\n\n"),
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
  choiceScores: { Y: 1, N: 0 },
  useCoT: true,
  model: "gpt-4o-mini",
});

// @ts-ignore - Type inference too deep with Zod parameters (works at runtime)
Eval(projectName, {
  experimentName: `l8r-eval-${new Date().toISOString().split("T")[0]}`,
  task,
  data: initDataset({ project: projectName, dataset: "L8rCustomerServiceDataset" }),
  scores: [toolCallCheck, structureCheck, helpfulnessCheck],
  parameters: {
    instructions: z
      .string()
      .describe("The instructions for the agent to follow")
      .default(defaultInstructions),
  },
});
