import { useState, useEffect } from "react";

interface TimerProps {
  duration: number;
  onDone: () => void;
}

export function Timer({ duration, onDone }: TimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (remaining <= 0) {
      setIsDone(true);
      const exitTimeout = setTimeout(() => {
        onDone();
      }, 2000);
      return () => clearTimeout(exitTimeout);
    }

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remaining, onDone]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeString = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  if (isDone) {
    return (
      <box
        style={{
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          height: "100%",
          padding: 4,
        }}
      >
        <text><b>Done. Momentum &gt; mood.</b></text>
      </box>
    );
  }

  return (
    <box
      style={{
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
        padding: 4,
      }}
    >
      <text><b>{timeString}</b></text>
    </box>
  );
}
