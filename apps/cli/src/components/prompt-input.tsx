import { useState } from "react";

interface PromptInputProps {
  label: string;
  onSubmit: (value: string) => void;
}

export function PromptInput({ label, onSubmit }: PromptInputProps) {
  const [value, setValue] = useState("");

  return (
    <box style={{ flexDirection: "column", padding: 2, gap: 1 }}>
      <text>
        <b>{label}</b>
      </text>
      <box style={{ height: 3, border: true, borderStyle: "rounded", padding: 1 }}>
        <input
          placeholder="Type here..."
          focused
          onInput={setValue}
          onSubmit={() => {
            if (value.trim()) {
              onSubmit(value.trim());
            }
          }}
        />
      </box>
    </box>
  );
}
