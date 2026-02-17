import { useState } from "react";

interface SessionResumeProps {
  task: string;
  onChoice: (resume: boolean) => void;
}

export function SessionResume({ task, onChoice }: SessionResumeProps) {
  const [value, setValue] = useState("");

  return (
    <box style={{ flexDirection: "column", padding: 2, gap: 1 }}>
      <text><b>You left a session in progress.</b></text>
      <text>Task: "{task}"</text>
      <text>Resume? (y/n)</text>
      <box style={{ height: 3, border: true, borderStyle: "rounded", padding: 1 }}>
        <input
          placeholder="y/n"
          focused
          onInput={setValue}
          onSubmit={() => {
            const answer = value.trim().toLowerCase();
            onChoice(answer.startsWith("y"));
          }}
        />
      </box>
    </box>
  );
}
