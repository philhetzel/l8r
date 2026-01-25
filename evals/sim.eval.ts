import { Eval, initDataset, traced } from "braintrust";
import OpenAI from "openai";
import * as dotenv from "dotenv";
import { z } from "zod";
import { chat, normalizeMessages, ChatMessage } from "../src/lib/chatbot";
import { systemPrompt } from "../src/lib/chatbot";

dotenv.config();

const projectName = process.env.BRAINTRUST_PROJECT_NAME || "l8r-customer-service";

// Unwrapped OpenAI client for simulated user - NOT traced
const simulatorClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_TURNS = 10;

/**
 * User profile extracted from seed conversation
 */
interface UserProfile {
  goal: string;
  personality: "direct" | "exploratory" | "frustrated" | "friendly" | "confused";
  communicationStyle: string;
  additionalContext: string;
}

/**
 * Simulated user's decision for next action
 */
interface UserDecision {
  action: "continue" | "satisfied" | "frustrated" | "follow_up";
  message: string;
  reasoning: string;
}

interface SimulatedConversation {
  messages: ChatMessage[];
  turnCount: number;
  completed: boolean;
  completionReason: "satisfied" | "frustrated" | "max_turns";
  userProfile: UserProfile;
}

/**
 * Extract user profile (goal + personality) from seed conversation.
 * Uses unwrapped client - NOT traced.
 */
async function extractUserProfile(seedMessages: ChatMessage[]): Promise<UserProfile> {
  const seedText = seedMessages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  // Get the first user message as the primary request
  const firstUserMessage = seedMessages.find(m => m.role === "user")?.content || "";

  const response = await simulatorClient.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Extract the user's specific goal and personality from a customer service conversation. Be VERY specific about the goal - use the exact request from the user's message.`,
      },
      {
        role: "user",
        content: `The user's first message was: "${firstUserMessage}"

Full conversation context:
${seedText}

Extract:
1. goal: The SPECIFIC thing they want (e.g., "check account balance", "view recent orders", "get refund for order X"). Use their exact words when possible.
2. personality: "direct" (brief, to-the-point), "exploratory" (curious, asks follow-ups), "frustrated" (upset), "friendly" (polite), or "confused" (uncertain)
3. communicationStyle: How they talk (brief/verbose, formal/casual)
4. additionalContext: Any specific details mentioned (order IDs, amounts, etc.)

Return JSON:
{
  "goal": "specific goal from their message",
  "personality": "direct|exploratory|frustrated|friendly|confused",
  "communicationStyle": "description",
  "additionalContext": "specific details if any"
}`,
      },
    ],
    max_tokens: 300,
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    return {
      goal: parsed.goal || firstUserMessage || "Get help with their account",
      personality: parsed.personality || "friendly",
      communicationStyle: parsed.communicationStyle || "Normal customer communication",
      additionalContext: parsed.additionalContext || "",
    };
  } catch {
    return {
      goal: firstUserMessage || "Get help with their account",
      personality: "friendly",
      communicationStyle: "Normal customer communication",
      additionalContext: "",
    };
  }
}

/**
 * Get the simulated user's next decision and message.
 * Uses unwrapped client - NOT traced.
 */
async function getSimulatedUserDecision(
  profile: UserProfile,
  conversationHistory: ChatMessage[]
): Promise<UserDecision> {
  const historyText = conversationHistory
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const personalityGuidance = {
    direct: "You are direct and to-the-point. Once your goal is met, you end the conversation promptly. You don't ask unnecessary follow-up questions.",
    exploratory: "You like to understand things thoroughly. Even after your main goal is met, you might ask follow-up questions or explore related topics.",
    frustrated: "You are impatient and easily frustrated. If the agent isn't helping quickly, you express dissatisfaction. You might give up if things take too long.",
    friendly: "You are polite and appreciative. You thank the agent when helped and might engage in brief pleasantries.",
    confused: "You need extra clarification and might ask the agent to explain things differently. You're uncertain and need reassurance.",
  };

  const response = await simulatorClient.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are simulating a customer with this profile:
- Goal: ${profile.goal}
- Personality: ${profile.personality}
- Style: ${profile.communicationStyle}
${profile.additionalContext ? `- Context: ${profile.additionalContext}` : ""}

${personalityGuidance[profile.personality]}

IMPORTANT: Be realistic about when your goal is achieved:
- If your goal is "check balance" and the agent told you dollar amounts, you're satisfied
- If your goal involves getting information and the agent provided relevant details, you're satisfied
- If the agent is actively helping and making progress, continue the conversation
- Only mark "frustrated" if the agent is truly unhelpful after 3+ exchanges (not just one turn)

Based on the conversation, decide your next action and provide a message. Return valid JSON only.`,
      },
      {
        role: "user",
        content: `Your goal: ${profile.goal}

Current conversation:
${historyText}

Decide your next action:
- "satisfied": The agent provided helpful information or completed your request. End positively with thanks.
- "frustrated": The agent has been unhelpful for 3+ turns and you're giving up. (Rare - only use if truly stuck)
- "follow_up": Your main goal is met but you want to ask something related (exploratory personalities only)
- "continue": You need more information or have a follow-up question about your original goal

Important: If the agent has answered your question or provided the info you asked for, choose "satisfied" - don't continue unnecessarily.

Return JSON:
{
  "action": "continue" | "satisfied" | "frustrated" | "follow_up",
  "message": "your next message (if satisfied, say thank you)",
  "reasoning": "why this action?"
}`,
      },
    ],
    max_tokens: 300,
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    return {
      action: parsed.action || "continue",
      message: parsed.message || "Can you help me?",
      reasoning: parsed.reasoning || "",
    };
  } catch {
    return {
      action: "continue",
      message: "Can you help me with this?",
      reasoning: "Failed to parse response",
    };
  }
}

/**
 * Run a simulated multi-turn conversation with traced turns
 */
async function runSimulatedConversation(
  seedMessages: ChatMessage[],
  instructions: string
): Promise<SimulatedConversation> {
  // Step 1: Extract user profile from seed conversation
  const userProfile = await extractUserProfile(seedMessages);

  const conversationHistory: ChatMessage[] = [];
  let turnCount = 0;
  let completed = false;
  let completionReason: "satisfied" | "frustrated" | "max_turns" = "max_turns";

  // Get the initial user message from the seed
  let userMessage: string;
  if (seedMessages.length > 0 && seedMessages[0].role === "user") {
    userMessage = seedMessages[0].content;
  } else {
    // Generate initial message based on profile
    const initialDecision = await getSimulatedUserDecision(userProfile, []);
    userMessage = initialDecision.message;
  }

  while (turnCount < MAX_TURNS && !completed) {
    turnCount++;
    const currentTurn = turnCount;

    // Wrap each turn in a parent span
    const turnResult = await traced(async (span) => {
      span.log({
        input: userMessage,
        metadata: { userProfile, turnNumber: currentTurn },
      });

      // Add user message to history
      conversationHistory.push({ role: "user", content: userMessage });

      // Get agent response
      const agentResult = await chat(conversationHistory, { instructions });
      const agentMessage = agentResult.content;
      conversationHistory.push({ role: "assistant", content: agentMessage });

      span.log({ output: agentMessage });

      return { agentMessage, reachedMaxTurns: currentTurn >= MAX_TURNS };
    }, { name: `turn_${currentTurn}` });

    // Check if we've reached max turns
    if (turnResult.reachedMaxTurns) {
      completionReason = "max_turns";
      break;
    }

    // Get simulated user's decision for next action
    const decision = await getSimulatedUserDecision(userProfile, conversationHistory);

    // Handle the decision
    if (decision.action === "satisfied" || decision.action === "follow_up") {
      // Add final message and end
      conversationHistory.push({ role: "user", content: decision.message });
      completed = true;
      completionReason = "satisfied";
    } else if (decision.action === "frustrated") {
      // User gives up
      conversationHistory.push({ role: "user", content: decision.message });
      completed = true;
      completionReason = "frustrated";
    } else {
      // Continue - use the decision's message for next turn
      userMessage = decision.message;
    }
  }

  return {
    messages: conversationHistory,
    turnCount,
    completed,
    completionReason,
    userProfile,
  };
}

/**
 * Task: Run a simulated conversation and return the conversation text
 */
async function task(input: any, hooks: any): Promise<string> {
  const seedMessages = normalizeMessages(input);
  const result = await runSimulatedConversation(
    seedMessages,
    hooks.parameters.instructions
  );

  // Format the conversation for output
  const conversationText = result.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  // Include metadata in the output string
  const profileSummary = `Goal: ${result.userProfile.goal} | Personality: ${result.userProfile.personality}`;
  return `[Turns: ${result.turnCount}, Outcome: ${result.completionReason}, ${profileSummary}]\n\n${conversationText}`;
}

// Scorer: Did the agent handle the conversation appropriately?
async function resolutionCheck({ output }: { output: string }) {
  const satisfied = output.includes("Outcome: satisfied");
  const frustrated = output.includes("Outcome: frustrated");

  // If the simulated user said they were satisfied, that's a strong signal
  if (satisfied) {
    return {
      name: "ResolutionCheck",
      score: 1,
      metadata: { satisfied, frustrated, reason: "User indicated satisfaction" },
    };
  }

  const response = await simulatorClient.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You evaluate customer service agent behavior. Be lenient. Respond with only Y or N.",
      },
      {
        role: "user",
        content: `Did the agent handle this conversation appropriately?

Answer Y if the agent:
- Provided helpful information for l8r-related requests
- Correctly redirected off-topic requests back to l8r services (this is GOOD behavior)
- Used tools to look up account data when relevant
- Was professional and helpful
- Made reasonable progress even if not fully complete

Answer N only if the agent:
- Was rude or dismissive
- Completely ignored a legitimate request
- Gave incorrect information

Note: If a user asked about something unrelated to l8r (like mushrooms) and the agent politely redirected them, that's CORRECT - score Y.

Conversation:
${output}

Answer Y if the agent behaved appropriately, N only if they clearly failed.`,
      },
    ],
    max_tokens: 10,
    temperature: 0,
  });

  const answer = response.choices[0]?.message?.content?.trim().toUpperCase();
  return {
    name: "ResolutionCheck",
    score: answer === "Y" ? 1 : 0,
    metadata: { satisfied, frustrated, llmAnswer: answer },
  };
}

// Scorer: Check conversation quality
async function qualityCheck({ output }: { output: string }) {
  const response = await simulatorClient.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You evaluate customer service conversation quality. Be generous - most professional conversations should pass. Respond with only Y or N.",
      },
      {
        role: "user",
        content: `Is this a reasonable customer service conversation?

Answer Y if the conversation meets these basic standards:
- The agent responds professionally (not rude or dismissive)
- The agent attempts to help the customer
- The responses are coherent and relevant

Answer N only if:
- The agent is rude or unhelpful
- The responses are completely off-topic
- There are major errors or confusion

Conversation:
${output}

Answer Y for acceptable quality, N only for clearly poor quality.`,
      },
    ],
    max_tokens: 10,
    temperature: 0,
  });

  const answer = response.choices[0]?.message?.content?.trim().toUpperCase();
  return {
    name: "QualityCheck",
    score: answer === "Y" ? 1 : 0,
    metadata: { llmAnswer: answer },
  };
}

// Scorer: Check if the agent handled the conversation appropriately
async function goalAchievementCheck({ output }: { output: string }) {
  // Extract goal from output metadata header: [Turns: X, Outcome: Y, Goal: Z | Personality: W]
  const goalMatch = output.match(/Goal: ([^|]+)/);
  const goal = goalMatch ? goalMatch[1].trim() : "unknown goal";
  const satisfied = output.includes("Outcome: satisfied");

  // If user explicitly said satisfied, the agent did well
  if (satisfied) {
    return {
      name: "GoalAchievement",
      score: 1,
      metadata: { goal, reason: "User indicated satisfaction" },
    };
  }

  const response = await simulatorClient.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You evaluate if a customer service agent handled a conversation appropriately. Respond with only Y or N.",
      },
      {
        role: "user",
        content: `The customer's stated goal was: "${goal}"

Did the agent handle this conversation appropriately?

Answer Y if ANY of these are true:
- The agent provided helpful information related to a legitimate l8r request
- The agent correctly redirected an off-topic request back to l8r services
- The agent looked up relevant account data (balance, orders, payments)
- The agent politely declined inappropriate requests while offering to help with l8r matters

Answer N only if:
- The agent was unhelpful or rude
- The agent ignored a legitimate l8r-related request
- The agent provided incorrect information

Note: If the user asked about something off-topic (like mushrooms, weather, etc.) and the agent redirected them to l8r services, that's CORRECT behavior - score Y.

Conversation:
${output}

Answer Y if the agent behaved appropriately, N if they failed.`,
      },
    ],
    max_tokens: 10,
    temperature: 0,
  });

  const answer = response.choices[0]?.message?.content?.trim().toUpperCase();
  return {
    name: "GoalAchievement",
    score: answer === "Y" ? 1 : 0,
    metadata: { goal, llmAnswer: answer },
  };
}

// @ts-ignore - Type inference issues with complex scorer types
Eval(projectName, {
  experimentName: `l8r-sim-eval-${new Date().toISOString().split("T")[0]}`,
  task,
  data: initDataset({ project: projectName, dataset: "L8rCustomerServiceDataset" }),
  scores: [resolutionCheck, qualityCheck, goalAchievementCheck],
  parameters: {
    instructions: z
      .string()
      .describe("The instructions for the agent to follow")
      .default(systemPrompt),
  },
});
