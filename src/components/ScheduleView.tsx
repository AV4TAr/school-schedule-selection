"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";

import { clearPins, generateSchedule, togglePin } from "@/app/actions";
import { analyzeSchedule, buildShiftRows } from "@/lib/analyze";
import { useI18n } from "@/lib/i18n/context";
import { toHours } from "@/lib/time";
import type {
  Assignment,
  AvailabilityWindow,
  Person,
  Shift,
  Weekday,
} from "@/lib/types";

interface Props {
  people: Person[];
  shifts: Shift[];
  availability: AvailabilityWindow[];
  assignments: Assignment[];
  /** Weekdays that have at least one shift, in order. */
  weekdays: Weekday[];
}

export function ScheduleView({
  people,
  shifts,
  availability,
  assignments,
  weekdays,
}: Props) {
  const { t, fmt, range, duration, weekday } = useI18n();
  const [pending, startTransition] = useTransition();

  const analysis = useMemo(
    () => analyzeSchedule(people, shifts, assignments, availability),
    [people, shifts, assignments, availability],
  );
  const rows = useMemo(() => buildShiftRows(shifts), [shifts]);
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const gapByShift = useMemo(
    () => new Map(analysis.gaps.map((g) => [g.shiftId, g])),
    [analysis.gaps],
  );

  const hasSchedule = assignments.length > 0;
  const pinnedCount = assignments.filter((a) => a.pinned).length;
  const maxMinutes = Math.max(1, ...analysis.workloads.map((w) => w.totalMinutes));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t.schedule.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.schedule.subtitle}</p>
        </div>
        <div className="no-print flex items-center gap-2">
          {pinnedCount > 0 && (
            <button
              type="button"
              className="btn"
              disabled={pending}
              onClick={() => startTransition(() => void clearPins())}
            >
              {t.schedule.clearPins} ({pinnedCount})
            </button>
          )}
          <Link className="btn" href="/print">
            {t.nav.print}
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() => startTransition(() => void generateSchedule())}
          >
            {pending
              ? t.schedule.generating
              : hasSchedule
                ? t.schedule.regenerate
                : t.schedule.generate}
          </button>
        </div>
      </header>

      {!hasSchedule ? (
        <p className="card p-8 text-center text-sm text-muted">{t.schedule.empty}</p>
      ) : (
        <>
          <CoverageBanner
            gaps={analysis.gaps}
            shifts={shifts}
            conflicts={analysis.conflicts}
          />

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="w-44 px-4 py-3 text-left text-xs font-medium tracking-wide text-muted uppercase">
                    {t.nav.shifts}
                  </th>
                  {weekdays.map((day) => (
                    <th
                      key={day}
                      className="px-3 py-3 text-left text-xs font-medium tracking-wide text-muted uppercase"
                    >
                      {weekday(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-line last:border-0">
                    <th className="px-4 py-3 text-left align-top font-medium">
                      <div>{row.name}</div>
                      <div className="mt-0.5 text-xs font-normal text-muted tabular-nums">
                        {range(row.startMin, row.endMin)}
                      </div>
                    </th>
                    {weekdays.map((day) => {
                      const shift = row.byWeekday.get(day);
                      if (!shift) {
                        return (
                          <td key={day} className="px-3 py-3 align-top text-muted/40">
                            –
                          </td>
                        );
                      }
                      const staff = assignments.filter((a) => a.shiftId === shift.id);
                      const gap = gapByShift.get(shift.id);
                      return (
                        <td key={day} className="px-3 py-3 align-top">
                          <div className="flex flex-col gap-1">
                            {staff.map((a) => (
                              <button
                                key={a.personId}
                                type="button"
                                disabled={pending}
                                title={a.pinned ? t.schedule.unpin : t.schedule.pin}
                                onClick={() =>
                                  startTransition(
                                    () => void togglePin(shift.id, a.personId),
                                  )
                                }
                                className={`group flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left text-sm transition ${
                                  a.pinned
                                    ? "border-accent bg-accent-soft font-medium text-accent"
                                    : "border-transparent bg-background hover:border-line"
                                }`}
                              >
                                <span
                                  aria-hidden
                                  className={
                                    a.pinned ? "opacity-100" : "opacity-20 group-hover:opacity-60"
                                  }
                                >
                                  📌
                                </span>
                                {personById.get(a.personId)?.name ?? "?"}
                              </button>
                            ))}
                            {staff.length === 0 && (
                              <span className="px-2 py-1 text-sm text-muted/60">
                                {t.schedule.unstaffed}
                              </span>
                            )}
                            {gap && (
                              <span
                                className={`mt-0.5 self-start rounded px-1.5 py-0.5 text-[11px] font-medium ${
                                  gap.critical
                                    ? "bg-danger-soft text-danger"
                                    : "bg-warn-soft text-warn"
                                }`}
                              >
                                {fmt(t.schedule.needed, {
                                  assigned: gap.assigned,
                                  ideal: gap.requiredIdeal,
                                })}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pinnedCount > 0 && (
            <p className="no-print text-xs text-muted">📌 {t.schedule.pinnedLegend}</p>
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold tracking-tight">
                {t.schedule.workloadTitle}
              </h2>
              <div className="flex gap-5 text-xs text-muted">
                <span title={t.schedule.spreadHint}>
                  {t.schedule.spread}:{" "}
                  <strong className="text-foreground tabular-nums">
                    {duration(analysis.spreadMinutes)}
                  </strong>
                </span>
                <span>
                  {t.schedule.totalStaffed}:{" "}
                  <strong className="text-foreground tabular-nums">
                    {duration(analysis.totalStaffedMinutes)}
                  </strong>
                </span>
              </div>
            </div>

            <div className="card divide-y divide-line">
              {analysis.workloads
                .slice()
                .sort((a, b) => b.totalMinutes - a.totalMinutes)
                .map((w) => {
                  const person = personById.get(w.personId);
                  if (!person) return null;
                  return (
                    <div
                      key={w.personId}
                      className="grid grid-cols-[9rem_1fr_auto] items-center gap-4 px-4 py-3"
                    >
                      <div className="truncate font-medium">
                        {person.name}
                        {!person.active && (
                          <span className="ml-2 text-xs font-normal text-muted">
                            ({t.common.inactive})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${(w.totalMinutes / maxMinutes) * 100}%` }}
                          />
                        </div>
                        <span className="w-20 text-right text-sm tabular-nums">
                          {toHours(w.totalMinutes)} h
                        </span>
                      </div>

                      <div className="flex gap-4 text-xs text-muted tabular-nums">
                        <span>
                          {t.schedule.daysWorked}: {w.daysWorked.length}
                        </span>
                        <span title={t.schedule.idleHint}>
                          {t.schedule.idle}: {duration(w.idleMinutes)}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function CoverageBanner({
  gaps,
  shifts,
  conflicts,
}: {
  gaps: ReturnType<typeof analyzeSchedule>["gaps"];
  shifts: Shift[];
  conflicts: Assignment[];
}) {
  const { t, fmt, range, weekday } = useI18n();
  const shiftById = new Map(shifts.map((s) => [s.id, s]));

  if (gaps.length === 0 && conflicts.length === 0) {
    return (
      <p className="rounded-lg border border-ok/30 bg-ok-soft px-4 py-3 text-sm text-ok">
        {t.schedule.coverageOk}
      </p>
    );
  }

  const critical = gaps.filter((g) => g.critical);
  const soft = gaps.filter((g) => !g.critical);

  return (
    <section className="card divide-y divide-line">
      <h2 className="px-4 py-3 text-sm font-semibold">{t.schedule.coverageTitle}</h2>

      {conflicts.length > 0 && (
        <p className="bg-danger-soft px-4 py-2.5 text-sm text-danger">
          {fmt(t.schedule.conflicts, { count: conflicts.length })}
        </p>
      )}

      <ul className="divide-y divide-line">
        {[...critical, ...soft].map((gap) => {
          const shift = shiftById.get(gap.shiftId);
          if (!shift) return null;
          return (
            <li
              key={gap.shiftId}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm"
            >
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                  gap.critical
                    ? "bg-danger-soft text-danger"
                    : "bg-warn-soft text-warn"
                }`}
              >
                {gap.critical ? t.schedule.criticalGap : t.schedule.idealGap}
              </span>
              <span className="font-medium">{weekday(shift.weekday)}</span>
              <span className="text-muted">{shift.name}</span>
              <span className="text-muted tabular-nums">
                {range(shift.startMin, shift.endMin)}
              </span>
              <span className="ml-auto text-muted tabular-nums">
                {fmt(t.schedule.needed, {
                  assigned: gap.assigned,
                  ideal: gap.requiredIdeal,
                })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
