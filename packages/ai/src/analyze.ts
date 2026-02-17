import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import type { DbClient } from "@seawatts/db";
import { buildMemoryContext } from "@seawatts/memory";
import { AvoidanceSchema } from "./schemas";
import type { AvoidanceResult } from "./schemas";
import { buildAnalysisPrompt } from "./prompts";

export async function analyzeAvoidance(
  task: string,
  spouseVersion: string,
  db: DbClient,
): Promise<AvoidanceResult> {
  const memoryContext = await buildMemoryContext(db, {
    taskText: task,
  });

  const result = await generateObject({
    model: openai("gpt-4.1-mini"),
    schema: AvoidanceSchema,
    prompt: buildAnalysisPrompt(task, spouseVersion, memoryContext),
  });

  return result.object as AvoidanceResult;
}
