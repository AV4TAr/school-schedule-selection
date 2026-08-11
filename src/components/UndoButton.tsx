"use client";

import { useEffect, useTransition } from "react";

import { undoLast } from "@/app/actions";
import { useI18n } from "@/lib/i18n/context";
import type { UndoLabel } from "@/lib/db/undo";

/**
 * Undo control for the header. Labels arrive as `{ key, params }` and are
 * translated here, so a step recorded in English still reads correctly after
 * switching to Spanish.
 */
export function UndoButton({
  scheduleId,
  labels,
}: {
  scheduleId: number;
  labels: UndoLabel[];
}) {
  const { t, fmt } = useI18n();
  const [pending, startTransition] = useTransition();

  const next = labels[0];
  const disabled = pending || !next;

  const describe = (label: UndoLabel) => {
    const template = t.undo.actions[label.key as keyof typeof t.undo.actions];
    if (!template) return t.undo.actions.unknown;
    return fmt(template, label.params ?? {});
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isUndo =
        (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "z";
      if (!isUndo) return;

      // Leave the browser's own undo alone while the user is editing a field.
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return;
      }

      event.preventDefault();
      if (labels.length > 0) startTransition(() => void undoLast(scheduleId));
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [labels.length, scheduleId, startTransition]);

  return (
    <button
      type="button"
      className="btn btn-sm"
      disabled={disabled}
      onClick={() => startTransition(() => void undoLast(scheduleId))}
      title={
        next
          ? `${fmt(t.undo.tooltip, { action: describe(next) })} · ${t.undo.shortcut}`
          : t.undo.empty
      }
    >
      <span aria-hidden>↶</span>
      <span className="hidden sm:inline">{t.undo.label}</span>
      {labels.length > 0 && <span className="pill">{labels.length}</span>}
    </button>
  );
}
