"use client";

import { useEffect, useRef, useState } from "react";

import { Sheet, anchorFrom, type SheetAnchor } from "@/components/Sheet";
import { useI18n } from "@/lib/i18n/context";
import type { Person } from "@/lib/types";

import { personColor } from "./person-hue";

/**
 * Adds a person to a shift by hand. Only lists people whose availability
 * covers the shift — manual control does not extend to breaking a hard rule.
 *
 * The list lives in a `<Sheet>`, which is an anchored popover from `md` up and
 * a bottom sheet on a phone. That replaces the hand-rolled portal this used to
 * carry: the popover still escapes the grid's `overflow-x: auto` clipping, and
 * the phone gets a full-width list of finger-sized rows for free.
 *
 * Two triggers, one menu. `variant="cell"` is the quiet `+` that sits in every
 * cell of the desktop grid; `variant="row"` is the full-width row at the foot
 * of a mobile shift card, where there is no hover to reveal anything.
 */
export function AddPersonMenu({
  candidates,
  hueOf,
  disabled,
  onAdd,
  variant = "cell",
}: {
  candidates: Person[];
  hueOf: Map<number, number>;
  disabled?: boolean;
  onAdd: (personId: number) => void;
  variant?: "cell" | "row";
}) {
  const { t } = useI18n();
  const [anchor, setAnchor] = useState<SheetAnchor | null>(null);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Only the wide-screen form is positioned in viewport coordinates, so only
  // it is invalidated by a scroll; the bottom sheet is pinned to the bottom
  // edge and must survive its own list scrolling (which bubbles to this
  // capture-phase listener).
  useEffect(() => {
    if (!open) return;
    if (!window.matchMedia("(min-width: 48rem)").matches) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (open) return setOpen(false);
    setAnchor(anchorFrom(buttonRef.current));
    setOpen(true);
  };

  return (
    <>
      {variant === "row" ? (
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          title={t.hints.addToShift}
          aria-expanded={open}
          onClick={toggle}
          className="btn btn-sm w-full justify-start text-muted transition active:scale-[0.98]"
        >
          <span aria-hidden>+</span>
          {t.schedule.addPerson}
        </button>
      ) : (
        /* Deliberately small and quiet: one of these sits in every cell, and at
           full width with a label they out-shouted the names they sit under. */
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          title={t.hints.addToShift}
          aria-label={t.schedule.addPerson}
          aria-expanded={open}
          onClick={toggle}
          className={`flex h-4.5 w-6 items-center justify-center rounded-[3px] text-xs leading-none transition ${
            open
              ? "bg-accent-soft text-accent"
              : "text-faint/40 group-hover/cell:text-muted hover:!bg-accent-soft hover:!text-accent focus-visible:text-accent"
          }`}
        >
          +
        </button>
      )}

      {open && (
        <Sheet anchor={anchor} title={t.schedule.addPerson} onClose={() => setOpen(false)}>
          {candidates.length === 0 ? (
            <p className="px-3 py-3 text-base text-muted">{t.schedule.noCandidates}</p>
          ) : (
            <div className="py-1">
              {candidates.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className="sheet-item"
                  onClick={() => {
                    setOpen(false);
                    onAdd(person.id);
                  }}
                >
                  <span
                    aria-hidden
                    className="chip-dot"
                    style={{ background: personColor(hueOf.get(person.id)) }}
                  />
                  <span className="truncate">{person.name}</span>
                </button>
              ))}
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}
