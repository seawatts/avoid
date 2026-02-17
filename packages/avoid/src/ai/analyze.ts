import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import type { Database } from "bun:sqlite";
import { AvoidanceSchema } from "./schemas";
import type { AvoidanceResult } from "./schemas";
import { buildAnalysisPrompt } from "./prompts";
import { buildMemoryContext } from "../memory/context";

export async function analyzeAvoidance(
  task: string,
  spouseVersion: string,
  db: Database,
): Promise<AvoidanceResult> {
  const memoryContext = buildMemoryContext(db);

  const { object } = await generateObject({
    model: openai("gpt-4.1-mini"),
    schema: AvoidanceSchema,
    prompt: buildAnalysisPrompt(task, spouseVersion, memoryContext),
  });

  return object;
}
