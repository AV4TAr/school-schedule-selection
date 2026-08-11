"use client";

import { useState } from "react";

import { parseTime, toTimeInput } from "@/lib/time";

/** Time input that only reports a change once it parses to a valid time. */
export function TimeField({
  value,
  disabled,
  onCommit,
  className = "field num w-26",
}: {
  value: number;
  disabled?: boolean;
  onCommit: (minutes: number) => void;
  /** Overridable so a caller can make the input full width on a phone. */
  className?: string;
}) {
  const [draft, setDraft] = useState(toTimeInput(value));

  // Re-sync when the value changes underneath us (another edit, a reset).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(toTimeInput(value));
  }

  return (
    <input
      type="time"
      className={className}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const parsed = parseTime(draft);
        if (parsed === null) return setDraft(toTimeInput(value));
        if (parsed !== value) onCommit(parsed);
      }}
    />
  );
}
