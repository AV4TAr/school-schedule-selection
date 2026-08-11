"use client";

import { useMemo, useState } from "react";

import { useI18n } from "@/lib/i18n/context";
import type { Assignment, CoverageGap, Person, Shift, Weekday } from "@/lib/types";

import { AddPersonMenu } from "./AddPersonMenu";

/** Today, mapped onto the Mon–Fri school week. Weekends fall back to Monday. */
function todayAsSchoolWeekday(): Weekday {
  const jsDay = new Date().getDay(); // 0 = Sunday .. 6 = Saturday
  return jsDay >= 1 && jsDay <= 5 ? (jsDay as Weekday) : 1;
}

interface Props {
  /** Weekdays that have at least one shift, in order. */
  weekdays: Weekday[];
  shifts: Shift[];
  assignments: Assignment[];
  people: Person[];
  hueOf: Map<number, number>;
  gapByShift: Map<number, CoverageGap>;
  /** `shiftId:personId` for every assignment that no longer fits availability. */
  conflictKeys: Set<string>;
  candidatesFor: (shift: Shift) => Person[];
  canEdit: boolean;
  pending: boolean;
  onTogglePin: (shiftId: number, personId: number) => void;
  onRemove: (shiftId: number, personId: number) => void;
  onAdd: (shiftId: number, personId: number) => void;
}

/**
 * The phone form of the grid: one day at a time, each shift a card. The same
 * information as the table — names, lock state, coverage, conflicts — but laid
 * out down the screen instead of across it, because a five-column matrix on a
 * 360px screen is a horizontally scrolling postage stamp.
 *
 * Rendered unconditionally and hidden with `md:hidden`; the dataset is five
 * days of a handful of shifts, so paying for both layouts is cheaper than a
 * media-query hook and its hydration flash.
 */
export function MobileSchedule({
  weekdays,
  shifts,
  assignments,
  people,
  hueOf,
  gapByShift,
  conflictKeys,
  candidatesFor,
  canEdit,
  pending,
  onTogglePin,
  onRemove,
  onAdd,
}: Props) {
  const { t, weekday } = useI18n();
  const [view, setView] = useState<"day" | "week">("day");
  const days = weekdays.length > 0 ? weekdays : ([1, 2, 3, 4, 5] as Weekday[]);
  const today = todayAsSchoolWeekday();
  const [selectedDay, setSelectedDay] = useState<Weekday>(() => {
    const start = todayAsSchoolWeekday();
    return days.includes(start) ? start : days[0];
  });

  const shiftsByDay = useMemo(() => {
    const map = new Map<Weekday, Shift[]>();
    for (const shift of shifts) {
      if (!shift.active) continue;
      const list = map.get(shift.weekday);
      if (list) list.push(shift);
      else map.set(shift.weekday, [shift]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startMin - b.startMin);
    return map;
  }, [shifts]);

  const cycleDay = (delta: 1 | -1) => {
    const idx = days.indexOf(selectedDay);
    setSelectedDay(days[(idx + delta + days.length) % days.length]);
  };

  const dayProps = {
    assignments,
    people,
    hueOf,
    gapByShift,
    conflictKeys,
    candidatesFor,
    canEdit,
    pending,
    onTogglePin,
    onRemove,
    onAdd,
  };

  return (
    <div className="space-y-3 md:hidden">
      <div className="seg" role="group" aria-label={t.schedule.title}>
        <button
          type="button"
          className="seg-item"
          aria-pressed={view === "day"}
          onClick={() => setView("day")}
        >
          {t.mySchedule.viewDay}
        </button>
        <button
          type="button"
          className="seg-item"
          aria-pressed={view === "week"}
          onClick={() => setView("week")}
        >
          {t.mySchedule.viewWeek}
        </button>
      </div>

      {view === "day" ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => cycleDay(-1)}
              aria-label={t.schedule.previousDay}
              className="btn btn-sm w-10 px-0"
            >
              ‹
            </button>
            <div className="text-center">
              <div className="text-sm font-semibold">{weekday(selectedDay)}</div>
              {selectedDay === today && (
                <div className="text-2xs text-accent">{t.mySchedule.today}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => cycleDay(1)}
              aria-label={t.schedule.nextDay}
              className="btn btn-sm w-10 px-0"
            >
              ›
            </button>
          </div>

          <DayShifts shifts={shiftsByDay.get(selectedDay) ?? []} {...dayProps} />
        </>
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <section key={day} className="space-y-2">
              <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
                {weekday(day)}
                {day === today && (
                  <span className="ml-1.5 text-accent">· {t.mySchedule.today}</span>
                )}
              </h2>
              <DayShifts shifts={shiftsByDay.get(day) ?? []} {...dayProps} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function DayShifts({
  shifts,
  assignments,
  people,
  hueOf,
  gapByShift,
  conflictKeys,
  candidatesFor,
  canEdit,
  pending,
  onTogglePin,
  onRemove,
  onAdd,
}: Omit<Props, "weekdays">) {
  const { t, range } = useI18n();
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  if (shifts.length === 0) {
    return (
      <p className="card px-4 py-6 text-center text-base text-muted">
        {t.mySchedule.noShiftsDayEveryone}
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {shifts.map((shift) => {
        const staff = assignments.filter((a) => a.shiftId === shift.id);
        const gap = gapByShift.get(shift.id);
        return (
          <article
            key={shift.id}
            className={`card overflow-hidden ${
              gap?.critical
                ? "border-l-2 border-l-[var(--c-danger)]"
                : gap
                  ? "border-l-2 border-l-[var(--c-warn)]"
                  : ""
            }`}
          >
            <header className="border-b border-line px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-base font-semibold">{shift.name}</h3>
                <span className="num shrink-0 text-xs text-faint">
                  {range(shift.startMin, shift.endMin)}
                </span>
              </div>
              {/* A phone has no hover, so the severity the desktop grid keeps
                  in a `title` is spelled out next to the count instead. */}
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={`pill ${
                    gap?.critical ? "pill-danger" : gap ? "pill-warn" : "pill-ok"
                  }`}
                >
                  <span aria-hidden>{gap?.critical ? "▾" : gap ? "!" : "✓"}</span>
                  <span className="num">
                    {staff.length}/{shift.requiredIdeal}
                  </span>
                </span>
                {gap && (
                  <span className="text-xs text-muted">
                    {gap.critical ? t.schedule.criticalGap : t.schedule.idealGap}
                  </span>
                )}
              </p>
            </header>

            <div className="divide-y divide-line">
              {staff.length === 0 && (
                <p className="px-3 py-2.5 text-base text-faint">{t.schedule.unstaffed}</p>
              )}

              {staff.map((a) => {
                const name = personById.get(a.personId)?.name ?? "?";
                const conflicted = conflictKeys.has(`${a.shiftId}:${a.personId}`);
                if (!canEdit) {
                  return (
                    <div
                      key={a.personId}
                      data-person={hueOf.get(a.personId) ?? 0}
                      data-pinned={a.pinned}
                      className="chip cursor-default px-3"
                    >
                      <span aria-hidden className="chip-dot" />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      {conflicted && (
                        <span className="pill pill-danger">{t.schedule.notAvailable}</span>
                      )}
                      {a.pinned && <span aria-hidden>🔒</span>}
                    </div>
                  );
                }
                return (
                  <div key={a.personId} className="flex items-center gap-1 px-1.5">
                    <button
                      type="button"
                      disabled={pending}
                      data-person={hueOf.get(a.personId) ?? 0}
                      data-pinned={a.pinned}
                      title={a.pinned ? t.hints.unpinChip : t.hints.pinChip}
                      aria-pressed={a.pinned}
                      onClick={() => onTogglePin(shift.id, a.personId)}
                      className="chip min-w-0 flex-1 transition active:scale-[0.98]"
                    >
                      <span aria-hidden className="chip-dot" />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      {conflicted && (
                        <span className="pill pill-danger">{t.schedule.notAvailable}</span>
                      )}
                      {/* Both states are drawn: with no hover on a phone, an
                          absent icon would be indistinguishable from an
                          unlockable row. */}
                      <span
                        aria-hidden
                        className={`text-xs ${a.pinned ? "" : "opacity-25 grayscale"}`}
                      >
                        🔒
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      title={t.hints.removeFromShift}
                      aria-label={`${t.schedule.removePerson}: ${name}`}
                      onClick={() => onRemove(shift.id, a.personId)}
                      className="btn btn-sm btn-ghost btn-danger shrink-0 px-2"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              {canEdit && (
                <div className="p-1.5">
                  <AddPersonMenu
                    variant="row"
                    disabled={pending}
                    candidates={candidatesFor(shift).filter(
                      (p) => !staff.some((a) => a.personId === p.id),
                    )}
                    hueOf={hueOf}
                    onAdd={(personId) => onAdd(shift.id, personId)}
                  />
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
