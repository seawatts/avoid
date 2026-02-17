export type SessionStatus = "in_progress" | "completed" | "abandoned";

export type AvoidanceType =
  | "Ambiguity"
  | "Fear"
  | "Perfectionism"
  | "Boredom"
  | "Energy mismatch"
  | "Social discomfort";

export type MemoryType = "observation" | "pattern" | "insight" | "summary";

export type AgentAction =
  | "ask_followup"
  | "surface_pattern"
  | "refine_task"
  | "suggest_action"
  | "offer_timer"
  | "end_session";

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  task: string | null;
  spousePerspective: string | null;
  avoidanceType: AvoidanceType | null;
  explanation: string | null;
  tenMinuteVersion: string | null;
  twoMinuteVersion: string | null;
  uglyFirstDraft: string | null;
  timerStarted: boolean;
  timerCompleted: boolean;
  agenticLog: AgenticTurn[];
}

export interface AgenticTurn {
  role: "ai" | "user";
  action?: AgentAction;
  message: string;
  timestamp: string;
}

export interface Memory {
  id: string;
  createdAt: string;
  sessionId: string | null;
  type: MemoryType;
  content: string;
  avoidanceType: AvoidanceType | null;
  importance: number;
  accessCount: number;
  lastAccessedAt: string | null;
  tags: string[];
}

export interface PatternSummary {
  id: string;
  createdAt: string;
  summaryText: string;
  data: Record<string, unknown>;
}

export type AppPhase =
  | "check_resume"
  | "prompt_task"
  | "prompt_spouse"
  | "analyzing"
  | "show_result"
  | "agentic_loop"
  | "timer_prompt"
  | "timer"
  | "done";
