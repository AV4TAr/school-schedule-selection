"use client";

import { useState } from "react";

import { createAvailability, deletePerson, updatePerson } from "@/app/actions";
import { AvailabilityWindowRow } from "@/components/people/AvailabilityWindowRow";
import { useI18n } from "@/lib/i18n/context";
import { type AvailabilityWindow, type Person, type Weekday } from "@/lib/types";

/**
 * These two warnings are whole sentences in a `.pill`, which is `nowrap` and
 * sized for a two-word badge — on a phone that is a sentence running off the
 * side of the card. Let it wrap and give it room to breathe below `md`, and
 * leave it as the compact badge it has always been above.
 */
const WARNING =
  "pill pill-warn block rounded-md px-2.5 py-1.5 text-xs whitespace-normal md:inline-flex md:rounded-full md:px-1.5 md:py-px md:text-2xs";

export function PersonCard({
  scheduleId,
  person,
  hue,
  windows,
  pending,
  run,
}: {
  scheduleId: number;
  person: Person;
  hue: number;
  windows: AvailabilityWindow[];
  pending: boolean;
  run: (fn: () => void) => void;
}) {
  const { t, fmt } = useI18n();
  const [name, setName] = useState(person.name);

  // Phone only: a roster of eight people with five windows each is metres of
  // scrolling, so the windows start folded away behind the count. Someone with
  // no windows at all starts open, otherwise the only way to add the first one
  // is hidden behind a control that reads "0 windows".
  //
  // The list is always in the DOM and only ever hidden with `display: none`,
  // which `md:block` unconditionally undoes — so from `md` up the windows are
  // always visible whatever this state says, and no draft edit is ever
  // unmounted (folding a card up simply blurs the focused input, which commits
  // it through the same path as clicking away).
  const [open, setOpen] = useState(windows.length === 0);
  const listId = `person-${person.id}-windows`;

  // Overlaps make the effective preference ambiguous, so say so rather than
  // silently resolving it.
  const overlapping = windows.some((a) =>
    windows.some(
      (b) =>
        a.id !== b.id &&
        a.weekday === b.weekday &&
        a.startMin < b.endMin &&
        b.startMin < a.endMin,
    ),
  );

  // Folded shut with no warning to show, the body below the header holds
  // nothing — left rendered it is an empty padded strip under a divider that
  // reads as a rendering fault. From `md` up the body is always visible, so
  // this only ever applies to the phone layout.
  const bodyVisible = open || overlapping || windows.length === 0;

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === person.name) return setName(person.name);
    run(() => void updatePerson(scheduleId, person.id, { name: trimmed }));
  };

  const windowCount =
    windows.length === 1
      ? t.people.windowCountOne
      : fmt(t.people.windowCountMany, { count: windows.length });

  return (
    <section className={`card overflow-hidden ${person.active ? "" : "opacity-65"}`}>
      {/* Two stacked rows on a phone — name on its own line, everything else
          beneath it. `md:contents` dissolves both wrappers from `md` up, which
          restores the single flex-wrap row this header has always been. */}
      <div
        className={`flex flex-col gap-2 border-line bg-raised/50 px-4 py-2.5 md:flex-row md:flex-wrap md:items-center md:gap-3 ${
          bodyVisible ? "border-b" : "md:border-b"
        }`}
      >
        <div className="flex items-center gap-3 md:contents">
          <span
            aria-hidden
            className="chip-dot"
            style={{ background: `var(--c-p${hue === 0 ? 6 : hue})` }}
          />
          <input
            className="field flex-1 font-medium md:w-52 md:flex-initial"
            value={name}
            disabled={pending}
            aria-label={t.common.name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </div>

        <div className="flex items-center gap-2 md:contents">
          <label
            className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[var(--r-sm)] border border-line bg-surface px-3 text-base text-muted md:min-h-0 md:border-transparent md:bg-transparent md:px-0"
            title={t.hints.personActive}
          >
            <input
              type="checkbox"
              checked={person.active}
              disabled={pending}
              onChange={(e) =>
                run(() => void updatePerson(scheduleId, person.id, { active: e.target.checked }))
              }
            />
            {t.common.active}
          </label>

          {/* The count doubles as the fold control on a phone; from `md` up the
              windows are always shown, so it goes back to being a plain pill
              rather than a button that would claim to toggle nothing. */}
          <button
            type="button"
            className="pill min-h-11 gap-1.5 px-3 md:hidden"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((v) => !v)}
          >
            {windowCount}
            <span aria-hidden>{open ? "▾" : "▸"}</span>
          </button>
          <span className="hidden pill md:inline-flex">{windowCount}</span>

          <button
            type="button"
            className="btn btn-ghost btn-danger ml-auto"
            title={t.hints.deletePerson}
            disabled={pending}
            onClick={() => {
              if (confirm(t.common.confirmDelete))
                run(() => void deletePerson(scheduleId, person.id));
            }}
          >
            {t.people.deletePerson}
          </button>
        </div>
      </div>

      <div className={`space-y-1.5 px-4 py-3 ${bodyVisible ? "" : "hidden md:block"}`}>
        {/* Warnings stay outside the fold: they are the reason to open it. */}
        {overlapping && <p className={WARNING}>{t.people.overlapWarning}</p>}
        {windows.length === 0 && <p className={WARNING}>{t.people.noWindows}</p>}

        <div id={listId} className={`space-y-1.5 ${open ? "" : "hidden"} md:block`}>
          {windows.length > 0 && (
            <ul className="space-y-2 md:space-y-1.5">
              {windows.map((w) => (
                <AvailabilityWindowRow
                  key={w.id}
                  scheduleId={scheduleId}
                  window={w}
                  pending={pending}
                  run={run}
                />
              ))}
            </ul>
          )}

          <button
            type="button"
            className="btn mt-1 w-full md:w-auto md:px-2 md:py-1 md:text-xs"
            title={t.hints.addWindow}
            disabled={pending}
            onClick={() => {
              // The list is sorted by weekday then start time, so a new window
              // needs a weekday past whatever this person already has, or it
              // sorts to the top instead of landing next to this button.
              const lastWeekday = windows.reduce((max, w) => Math.max(max, w.weekday), 0);
              const nextWeekday = Math.min(5, lastWeekday + 1) as Weekday;
              run(() =>
                void createAvailability(scheduleId, person.id, nextWeekday, 8 * 60, 13 * 60 + 15),
              );
            }}
          >
            + {t.people.addWindow}
          </button>
        </div>
      </div>
    </section>
  );
}
