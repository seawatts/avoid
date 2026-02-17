import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import type { Database } from "bun:sqlite";
import { AgentActionSchema } from "./schemas";
import type { AgentActionResult } from "./schemas";
import type { AvoidanceResult } from "./schemas";
import type { AgenticTurn } from "../types";
import { buildAgenticPrompt } from "./prompts";
import { buildMemoryContext } from "../memory/context";

export interface AgentStepInput {
  task: string;
  spousePerspective: string;
  classification: AvoidanceResult;
  conversationLog: AgenticTurn[];
  db: Database;
}

export async function agentStep(input: AgentStepInput): Promise<AgentActionResult> {
  const { task, spousePerspective, classification, conversationLog, db } = input;

  const memoryContext = buildMemoryContext(db);

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

  const { object } = await generateObject({
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

  return object;
}
