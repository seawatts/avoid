import { useState } from "react";
import type { AgenticTurn } from "@seawatts/db";
import type { AgentActionResult } from "@seawatts/ai";

interface AgenticChatProps {
  log: AgenticTurn[];
  currentAction: AgentActionResult | null;
  isLoading: boolean;
  onInput: (value: string) => void;
}

export function AgenticChat({ log, currentAction, isLoading, onInput }: AgenticChatProps) {
  const [inputValue, setInputValue] = useState("");

  const showInput = currentAction?.requiresInput && !isLoading;

  return (
    <box style={{ flexDirection: "column", padding: 2, gap: 1 }}>
      {log.map((turn, i) => (
        <box key={`turn-${i}`} style={{ flexDirection: "column" }}>
          {turn.role === "ai" ? (
            <text>{turn.message}</text>
          ) : (
            <text>
              <span fg="#666666">&gt; </span>
              {turn.message}
            </text>
          )}
        </box>
      ))}

      {isLoading && <text fg="#666666">Thinking...</text>}

      {showInput && (
        <box style={{ height: 3, border: true, borderStyle: "rounded", padding: 1, marginTop: 1 }}>
          <input
            placeholder="Your response (or type 'done' to finish)..."
            focused
            onInput={setInputValue}
            onSubmit={() => {
              if (inputValue.trim()) {
                onInput(inputValue.trim());
                setInputValue("");
              }
            }}
          />
        </box>
      )}

      {!showInput && !isLoading && <text fg="#666666">Press Enter to continue...</text>}
      {!showInput && !isLoading && <input focused onSubmit={() => onInput("")} />}
    </box>
  );
}
