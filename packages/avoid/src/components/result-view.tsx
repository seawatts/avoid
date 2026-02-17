import type { AvoidanceResult } from "../ai/schemas";

interface ResultViewProps {
  result: AvoidanceResult;
  onContinue: () => void;
}

export function ResultView({ result, onContinue }: ResultViewProps) {
  return (
    <box style={{ flexDirection: "column", padding: 2, gap: 1 }}>
      <text>
        <span bold>Avoidance type: </span>
        {result.type}
      </text>

      <text>{result.explanation}</text>

      <box style={{ flexDirection: "column", gap: 1, paddingTop: 1 }}>
        <text>
          <span bold>10-minute version: </span>
          {result.tenMinuteVersion}
        </text>
        <text>
          <span bold>2-minute version: </span>
          {result.twoMinuteVersion}
        </text>
        <text>
          <span bold>Ugly first draft: </span>
          {result.uglyFirstDraft}
        </text>
      </box>

      <box style={{ paddingTop: 1 }}>
        <text dim>Press Enter to continue...</text>
        <input
          focused
          onSubmit={() => onContinue()}
        />
      </box>
    </box>
  );
}
