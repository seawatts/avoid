import { useState, useEffect, useCallback } from "react";
import type { AppPhase, Session, AgenticTurn } from "./types";
import type { AvoidanceResult } from "./ai/schemas";
import type { AgentActionResult } from "./ai/schemas";
import { getStore } from "./memory/store";
import { analyzeAvoidance } from "./ai/analyze";
import { agentStep } from "./ai/agentic";
import { createMemory, createSession, updateSession, getInProgressSession } from "./memory/store";
import { SessionResume } from "./components/session-resume";
import { PromptInput } from "./components/prompt-input";
import { ResultView } from "./components/result-view";
import { AgenticChat } from "./components/agentic-chat";
import { Timer } from "./components/timer";

export function App() {
  const [phase, setPhase] = useState<AppPhase>("check_resume");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [task, setTask] = useState("");
  const [spousePerspective, setSpousePerspective] = useState("");
  const [result, setResult] = useState<AvoidanceResult | null>(null);
  const [agenticLog, setAgenticLog] = useState<AgenticTurn[]>([]);
  const [currentAiMessage, setCurrentAiMessage] = useState<AgentActionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (phase === "check_resume") {
      const db = getStore();
      const existing = getInProgressSession(db);
      if (existing) {
        setSessionId(existing.id);
        setTask(existing.task ?? "");
        setSpousePerspective(existing.spousePerspective ?? "");
        if (existing.avoidanceType) {
          setResult({
            type: existing.avoidanceType,
            explanation: existing.explanation ?? "",
            tenMinuteVersion: existing.tenMinuteVersion ?? "",
            twoMinuteVersion: existing.twoMinuteVersion ?? "",
            uglyFirstDraft: existing.uglyFirstDraft ?? "",
          });
          setAgenticLog(existing.agenticLog);
        }
      } else {
        setPhase("prompt_task");
      }
    }
  }, [phase]);

  const handleResume = useCallback((resume: boolean) => {
    if (resume && result) {
      setPhase("agentic_loop");
      runAgenticStep(agenticLog);
    } else {
      if (sessionId) {
        const db = getStore();
        updateSession(db, sessionId, { status: "abandoned" });
      }
      setSessionId(null);
      setTask("");
      setSpousePerspective("");
      setResult(null);
      setAgenticLog([]);
      setPhase("prompt_task");
    }
  }, [result, agenticLog, sessionId]);

  const handleTaskSubmit = useCallback((value: string) => {
    setTask(value);
    const db = getStore();
    const session = createSession(db);
    setSessionId(session.id);
    updateSession(db, session.id, { task: value });
    setPhase("prompt_spouse");
  }, []);

  const handleSpouseSubmit = useCallback(async (value: string) => {
    setSpousePerspective(value);
    if (!sessionId) return;
    const db = getStore();
    updateSession(db, sessionId, { spousePerspective: value });
    setPhase("analyzing");
    setIsLoading(true);

    try {
      const analysisResult = await analyzeAvoidance(task, value, db);
      setResult(analysisResult);
      updateSession(db, sessionId, {
        avoidanceType: analysisResult.type,
        explanation: analysisResult.explanation,
        tenMinuteVersion: analysisResult.tenMinuteVersion,
        twoMinuteVersion: analysisResult.twoMinuteVersion,
        uglyFirstDraft: analysisResult.uglyFirstDraft,
      });

      createMemory(db, {
        sessionId,
        type: "observation",
        content: `Avoided task "${task}" due to ${analysisResult.type}: ${analysisResult.explanation}`,
        avoidanceType: analysisResult.type,
        importance: 1.0,
        tags: [analysisResult.type.toLowerCase()],
      });

      setIsLoading(false);
      setPhase("show_result");
    } catch {
      setIsLoading(false);
      setPhase("show_result");
    }
  }, [task, sessionId]);

  const runAgenticStep = useCallback(async (log: AgenticTurn[]) => {
    if (!result || !sessionId) return;
    setIsLoading(true);

    try {
      const db = getStore();
      const action = await agentStep({
        task,
        spousePerspective,
        classification: result,
        conversationLog: log,
        db,
      });

      setCurrentAiMessage(action);

      if (action.memoryToStore) {
        createMemory(db, {
          sessionId,
          type: "insight",
          content: action.memoryToStore,
          avoidanceType: result.type,
          importance: 0.8,
          tags: ["agentic"],
        });
      }

      const newTurn: AgenticTurn = {
        role: "ai",
        action: action.action,
        message: action.message,
        timestamp: new Date().toISOString(),
      };
      const updatedLog = [...log, newTurn];
      setAgenticLog(updatedLog);
      updateSession(db, sessionId, { agenticLog: updatedLog });

      if (action.action === "offer_timer") {
        setPhase("timer_prompt");
      } else if (action.action === "end_session") {
        handleSessionEnd(false);
      } else {
        setPhase("agentic_loop");
      }
    } catch {
      setPhase("timer_prompt");
    } finally {
      setIsLoading(false);
    }
  }, [result, sessionId, task, spousePerspective]);

  const handleAgenticInput = useCallback((value: string) => {
    if (value.toLowerCase() === "done" || value.toLowerCase() === "exit") {
      handleSessionEnd(false);
      return;
    }

    const userTurn: AgenticTurn = {
      role: "user",
      message: value,
      timestamp: new Date().toISOString(),
    };
    const updatedLog = [...agenticLog, userTurn];
    setAgenticLog(updatedLog);

    if (sessionId) {
      const db = getStore();
      updateSession(db, sessionId, { agenticLog: updatedLog });
    }

    runAgenticStep(updatedLog);
  }, [agenticLog, sessionId, runAgenticStep]);

  const handleShowResultContinue = useCallback(() => {
    setPhase("agentic_loop");
    runAgenticStep(agenticLog);
  }, [agenticLog, runAgenticStep]);

  const handleTimerChoice = useCallback((start: boolean) => {
    if (start) {
      if (sessionId) {
        const db = getStore();
        updateSession(db, sessionId, { timerStarted: true });
      }
      setPhase("timer");
    } else {
      handleSessionEnd(false);
    }
  }, [sessionId]);

  const handleTimerDone = useCallback(() => {
    handleSessionEnd(true);
  }, []);

  const handleSessionEnd = useCallback((timerCompleted: boolean) => {
    if (sessionId) {
      const db = getStore();
      updateSession(db, sessionId, {
        status: "completed",
        timerCompleted,
      });

      const outcome = timerCompleted
        ? `Completed 10-minute timer for task "${task}"`
        : `Session ended without timer for task "${task}"`;

      createMemory(db, {
        sessionId,
        type: "observation",
        content: outcome,
        avoidanceType: result?.type ?? null,
        importance: timerCompleted ? 1.2 : 0.6,
        tags: timerCompleted ? ["completed", "timer"] : ["ended"],
      });
    }
    setPhase("done");
  }, [sessionId, task, result]);

  switch (phase) {
    case "check_resume":
      if (sessionId && task) {
        return <SessionResume task={task} onChoice={handleResume} />;
      }
      return (
        <box style={{ flexDirection: "column", padding: 2 }}>
          <text>Loading...</text>
        </box>
      );

    case "prompt_task":
      return (
        <PromptInput
          label="What task feels slightly heavy or uncomfortable right now?"
          onSubmit={handleTaskSubmit}
        />
      );

    case "prompt_spouse":
      return (
        <PromptInput
          label="If I took your laptop away and asked your spouse what you're procrastinating on, what would they say?"
          onSubmit={handleSpouseSubmit}
        />
      );

    case "analyzing":
      return (
        <box style={{ flexDirection: "column", padding: 2 }}>
          <text>Analyzing your avoidance pattern...</text>
        </box>
      );

    case "show_result":
      return result ? (
        <ResultView result={result} onContinue={handleShowResultContinue} />
      ) : (
        <box style={{ flexDirection: "column", padding: 2 }}>
          <text>Something went wrong. Press Ctrl+C to exit.</text>
        </box>
      );

    case "agentic_loop":
      return (
        <AgenticChat
          log={agenticLog}
          currentAction={currentAiMessage}
          isLoading={isLoading}
          onInput={handleAgenticInput}
        />
      );

    case "timer_prompt":
      return (
        <box style={{ flexDirection: "column", padding: 2, gap: 1 }}>
          <text>
            <span bold>Start a 10 minute timer now?</span>
          </text>
          <PromptInput
            label="(y/n)"
            onSubmit={(v) => handleTimerChoice(v.toLowerCase().startsWith("y"))}
          />
        </box>
      );

    case "timer":
      return <Timer duration={600} onDone={handleTimerDone} />;

    case "done":
      return (
        <box style={{ flexDirection: "column", padding: 2 }}>
          <text>Done. Momentum &gt; mood.</text>
        </box>
      );

    default:
      return null;
  }
}
