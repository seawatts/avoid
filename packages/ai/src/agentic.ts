import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import type { DbClient, AgenticTurn } from "@seawatts/db";
import { buildMemoryContext } from "@seawatts/memory";
import { AgentActionSchema } from "./schemas";
import type { AgentActionResult, AvoidanceResult } from "./schemas";
import { buildAgenticPrompt } from "./prompts";

export interface AgentStepInput {
  task: string;
  spousePerspective: string;
  classification: AvoidanceResult;
  conversationLog: AgenticTurn[];
  db: DbClient;
}

export async function agentStep(input: AgentStepInput): Promise<AgentActionResult> {
  const { task, spousePerspective, classification, conversationLog, db } = input;

  const memoryContext = await buildMemoryContext(db, {
    taskText: task,
    matchAvoidanceType: classification.type,
    matchTags: [classification.type.toLowerCase()],
  });

  const classificationSummary = [
    `Type: ${classification.type}`,
    `Explanation: ${classification.explanation}`,
    `10-min version: ${classification.tenMinuteVersion}`,
    `2-min version: ${classification.twoMinuteVersion}`,
    `Ugly first draft: ${classification.uglyFirstDraft}`,
  ].join("\n");

  const conversationText = conversationLog
    .map((turn) => {
      const prefix = turn.role === "ai" ? "Assistant" : "User";
      return `${prefix}: ${turn.message}`;
    })
    .join("\n");

  const result = await generateObject({
    model: openai("gpt-4.1-mini"),
    schema: AgentActionSchema,
    prompt: buildAgenticPrompt(
      task,
      spousePerspective,
      classificationSummary,
      conversationText,
      memoryContext,
    ),
  });

  return result.object as AgentActionResult;
}
