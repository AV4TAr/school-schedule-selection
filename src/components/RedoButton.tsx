"use client";

import { useCallback, useEffect, useTransition } from "react";

import { redoLast } from "@/app/actions";
import { useI18n } from "@/lib/i18n/context";
import type { UndoLabel } from "@/lib/db/undo";

/**
 * Redo control for the header, mirroring `UndoButton`. Labels reuse
 * `t.undo.actions` — a redo entry describes the same action an undo entry
 * would, just framed as "do this again" instead of "reverse this".
 */
export function RedoButton({
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

  const describe = useCallback(
    (label: UndoLabel) => {
      const template = t.undo.actions[label.key as keyof typeof t.undo.actions];
      if (!template) return t.undo.actions.unknown;
      return fmt(template, label.params ?? {});
    },
    [t, fmt],
  );

  const confirmAndRedo = useCallback(() => {
    if (!next || !confirm(fmt(t.redo.confirm, { action: describe(next) }))) return;
    startTransition(() => void redoLast(scheduleId));
  }, [next, describe, fmt, t, scheduleId, startTransition]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isRedo =
        ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "z") ||
        (event.ctrlKey && event.key.toLowerCase() === "y");
      if (!isRedo) return;

      // Leave the browser's own redo alone while the user is editing a field.
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return;
      }

      event.preventDefault();
      confirmAndRedo();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmAndRedo]);

  return (
    <button
      type="button"
      className="btn btn-sm"
      disabled={disabled}
      onClick={confirmAndRedo}
      title={
        next
          ? `${fmt(t.redo.tooltip, { action: describe(next) })} · ${t.redo.shortcut}`
          : t.redo.empty
      }
    >
      <span aria-hidden>↷</span>
      <span className="hidden sm:inline">{t.redo.label}</span>
      {labels.length > 0 && <span className="pill">{labels.length}</span>}
    </button>
  );
}
