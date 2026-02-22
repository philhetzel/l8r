import * as braintrust from "braintrust";
import { z } from "zod";
import { systemPrompt } from "../../src/lib/chatbot";

const project = braintrust.projects.create({
  name: "l8r-customer-service",
});

export const evalConfig = project.parameters.create({
  name: "SimulationConfig",
  slug: "simulation-config",
  description: "Configuration for simulated conversation evaluation",
  schema: {
    instructions: z.string().default(systemPrompt).describe("Model to evaluate"),
  }
});