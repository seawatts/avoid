import type { AvoidanceResult } from "@seawatts/ai";

interface ResultViewProps {
  result: AvoidanceResult;
  onContinue: () => void;
}

export function ResultView({ result, onContinue }: ResultViewProps) {
  return (
    <box style={{ flexDirection: "column", padding: 2, gap: 1 }}>
      <text>
        <b>Avoidance type: </b>
        {result.type}
      </text>

      <text>{result.explanation}</text>

      <box style={{ flexDirection: "column", gap: 1, paddingTop: 1 }}>
        <text>
          <b>10-minute version: </b>
          {result.tenMinuteVersion}
        </text>
        <text>
          <b>2-minute version: </b>
          {result.twoMinuteVersion}
        </text>
        <text>
          <b>Ugly first draft: </b>
          {result.uglyFirstDraft}
        </text>
      </box>

      <box style={{ paddingTop: 1 }}>
        <text fg="#666666">Press Enter to continue...</text>
        <input focused onSubmit={() => onContinue()} />
      </box>
    </box>
  );
}
