import { z } from "zod";

export const AvoidanceSchema = z.object({
  type: z.enum([
    "Ambiguity",
    "Fear",
    "Perfectionism",
    "Boredom",
    "Energy mismatch",
    "Social discomfort",
  ]),
  explanation: z.string().max(300),
  tenMinuteVersion: z.string().max(140),
  twoMinuteVersion: z.string().max(140),
  uglyFirstDraft: z.string().max(140),
});

export type AvoidanceResult = z.infer<typeof AvoidanceSchema>;

export const AgentActionSchema = z.object({
  action: z.enum([
    "ask_followup",
    "surface_pattern",
    "refine_task",
    "suggest_action",
    "offer_timer",
    "end_session",
  ]),
  message: z.string(),
  requiresInput: z.boolean(),
  memoryToStore: z.string().optional(),
});

export type AgentActionResult = z.infer<typeof AgentActionSchema>;
