import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import type { DbClient } from "@seawatts/db";
import { AvoidanceSchema } from "./schemas";
import type { AvoidanceResult } from "./schemas";
import { buildAnalysisPrompt } from "./prompts";
import { buildMemoryContext } from "./context";

export async function analyzeAvoidance(
  task: string,
  spouseVersion: string,
  db: DbClient,
): Promise<AvoidanceResult> {
  const memoryContext = buildMemoryContext(db);

  const result = await generateObject({
    model: openai("gpt-4.1-mini"),
    schema: AvoidanceSchema,
    prompt: buildAnalysisPrompt(task, spouseVersion, memoryContext),
  });

  return result.object as AvoidanceResult;
}
