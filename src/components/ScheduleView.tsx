"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";

import { clearPins, generateSchedule, togglePin } from "@/app/actions";
import { analyzeSchedule, buildShiftRows, type ScheduleAnalysis } from "@/lib/analyze";
import { useI18n } from "@/lib/i18n/context";
import { toHours } from "@/lib/time";
import type { Assignment, AvailabilityWindow, Person, Shift, Weekday } from "@/lib/types";

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
  /** Stable colour per person, by position in the roster. */
  const hueOf = useMemo(
    () => new Map(people.map((p, i) => [p.id, (i + 1) % 6])),
    [people],
  );
  const gapByShift = useMemo(
    () => new Map(analysis.gaps.map((g) => [g.shiftId, g])),
    [analysis.gaps],
  );

  const hasSchedule = assignments.length > 0;
  const pinnedCount = assignments.filter((a) => a.pinned).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{t.schedule.title}</h1>
          <p className="mt-1 text-base text-muted">{t.schedule.subtitle}</p>
        </div>
        <div className="no-print flex items-center gap-2">
          {pinnedCount > 0 && (
            <button
              type="button"
              className="btn"
              title={t.hints.clearPins}
              disabled={pending}
              onClick={() => startTransition(() => void clearPins())}
            >
              {t.schedule.clearPins}
              <span className="pill pill-neutral">{pinnedCount}</span>
            </button>
          )}
          <Link className="btn" href="/print" title={t.hints.print}>
            {t.nav.print}
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            title={t.hints.generate}
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
        <div className="card grid place-items-center gap-3 px-6 py-16 text-center">
          <p className="text-base text-muted">{t.schedule.empty}</p>
          <button
            type="button"
            className="btn btn-primary"
            title={t.hints.generate}
            disabled={pending}
            onClick={() => startTransition(() => void generateSchedule())}
          >
            {t.schedule.generate}
          </button>
        </div>
      ) : (
        <>
          <CoverageBanner analysis={analysis} shifts={shifts} />

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[54rem] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="col-head sticky left-0 z-10 w-44 bg-surface pl-4">
                    {t.nav.shifts}
                  </th>
                  {weekdays.map((day) => (
                    <th key={day} className="col-head">
                      {weekday(day)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-line last:border-0">
                    <th className="sticky left-0 z-10 bg-surface py-2.5 pr-3 pl-4 text-left align-top">
                      <div className="text-sm font-semibold">{row.name}</div>
                      <div className="num mt-0.5 text-2xs font-normal text-faint">
                        {range(row.startMin, row.endMin)}
                      </div>
                    </th>
                    {weekdays.map((day) => {
                      const shift = row.byWeekday.get(day);
                      if (!shift) {
                        return (
                          <td
                            key={day}
                            className="px-3 py-2.5 align-top text-sm text-faint/50"
                          >
                            ·
                          </td>
                        );
                      }
                      const staff = assignments.filter((a) => a.shiftId === shift.id);
                      const gap = gapByShift.get(shift.id);
                      return (
                        <td key={day} className="p-1.5 align-top">
                          <div
                            className={`flex flex-col gap-0.5 rounded-[var(--r-md)] border-l-2 py-1 pr-1 pl-1.5 ${
                              gap?.critical
                                ? "border-l-[var(--c-danger)] bg-danger-soft/45"
                                : gap
                                  ? "border-l-[var(--c-warn)] bg-warn-soft/40"
                                  : "border-l-transparent"
                            }`}
                          >
                            {staff.map((a) => (
                              <button
                                key={a.personId}
                                type="button"
                                disabled={pending}
                                data-person={hueOf.get(a.personId) ?? 0}
                                data-pinned={a.pinned}
                                title={a.pinned ? t.hints.unpinChip : t.hints.pinChip}
                                onClick={() =>
                                  startTransition(
                                    () => void togglePin(shift.id, a.personId),
                                  )
                                }
                                className="chip"
                              >
                                <span aria-hidden className="chip-dot" />
                                <span className="truncate">
                                  {personById.get(a.personId)?.name ?? "?"}
                                </span>
                                {a.pinned && (
                                  <span aria-hidden className="ml-auto text-2xs">
                                    🔒
                                  </span>
                                )}
                              </button>
                            ))}

                            {staff.length === 0 && (
                              <span className="px-1 py-0.5 text-sm text-faint/70">
                                {t.schedule.unstaffed}
                              </span>
                            )}

                            {gap && (
                              <span
                                className={`pill mt-0.5 self-start ${
                                  gap.critical ? "pill-danger" : "pill-warn"
                                }`}
                              >
                                <span className="num">
                                  {gap.assigned}/{gap.requiredIdeal}
                                </span>
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
            <p className="no-print text-xs text-faint">🔒 {t.schedule.pinnedLegend}</p>
          )}

          <WorkloadPanel
            analysis={analysis}
            people={people}
            hueOf={hueOf}
            formatHours={(m) => `${toHours(m)} h`}
            formatDuration={duration}
            labels={{
              title: t.schedule.workloadTitle,
              spread: t.schedule.spread,
              spreadHint: t.schedule.spreadHint,
              total: t.schedule.totalStaffed,
              days: t.schedule.daysWorked,
              idle: t.schedule.idle,
              idleHint: t.schedule.idleHint,
              preferredMetHint: t.schedule.preferredMetHint,
              avoidedWorkedHint: t.schedule.avoidedWorkedHint,
              fairShare: t.schedule.fairShare,
              inactive: t.common.inactive,
            }}
            fmt={fmt}
          />
        </>
      )}
    </div>
  );
}

/** Hours per person, with a marker showing the even-split target. */
function WorkloadPanel({
  analysis,
  people,
  hueOf,
  formatHours,
  formatDuration,
  labels,
}: {
  analysis: ScheduleAnalysis;
  people: Person[];
  hueOf: Map<number, number>;
  formatHours: (minutes: number) => string;
  formatDuration: (minutes: number) => string;
  labels: Record<string, string>;
  fmt: (template: string, values: Record<string, string | number>) => string;
}) {
  const active = analysis.workloads.filter((w) =>
    people.some((p) => p.id === w.personId && p.active),
  );
  const mean =
    active.length > 0
      ? active.reduce((sum, w) => sum + w.totalMinutes, 0) / active.length
      : 0;
  const scale = Math.max(1, ...analysis.workloads.map((w) => w.totalMinutes), mean);

  return (
    <section className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="section-title">{labels.title}</h2>
        <div className="flex gap-5 text-xs text-muted">
          <span title={labels.spreadHint}>
            {labels.spread}{" "}
            <strong className="num font-semibold text-foreground">
              {formatDuration(analysis.spreadMinutes)}
            </strong>
          </span>
          <span>
            {labels.total}{" "}
            <strong className="num font-semibold text-foreground">
              {formatDuration(analysis.totalStaffedMinutes)}
            </strong>
          </span>
        </div>
      </div>

      <div className="card divide-y divide-line">
        {analysis.workloads
          .slice()
          .sort((a, b) => b.totalMinutes - a.totalMinutes)
          .map((w) => {
            const person = people.find((p) => p.id === w.personId);
            if (!person) return null;
            const hue = hueOf.get(person.id) ?? 0;
            const overMean = w.totalMinutes > mean;
            return (
              <div
                key={w.personId}
                className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-4 px-4 py-2.5"
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    aria-hidden
                    className="chip-dot"
                    style={{ background: `var(--c-p${hue === 0 ? 6 : hue})` }}
                  />
                  <span className="truncate text-sm font-medium">{person.name}</span>
                  {!person.active && (
                    <span className="pill pill-neutral">{labels.inactive}</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative h-2.5 flex-1 overflow-hidden rounded-[var(--r-full)] bg-raised">
                    <div
                      className="h-full rounded-[var(--r-full)]"
                      style={{
                        width: `${(w.totalMinutes / scale) * 100}%`,
                        background: `var(--c-p${hue === 0 ? 6 : hue})`,
                      }}
                    />
                    {/* Even-split target: everything to its right is above fair share. */}
                    <span
                      aria-hidden
                      title={labels.fairShare}
                      className="absolute top-0 h-full w-px bg-[var(--c-text)]/45"
                      style={{ left: `${(mean / scale) * 100}%` }}
                    />
                  </div>
                  <span
                    className={`num w-16 text-right text-sm font-medium ${
                      overMean ? "text-foreground" : "text-muted"
                    }`}
                  >
                    {formatHours(w.totalMinutes)}
                  </span>
                </div>

                <div className="num flex items-center gap-3 text-2xs text-faint">
                  <span>
                    {labels.days} {w.daysWorked.length}
                  </span>
                  <span title={labels.idleHint}>
                    {labels.idle} {formatDuration(w.idleMinutes)}
                  </span>
                  {w.preferredMinutes > 0 && (
                    <span className="pill pill-ok" title={labels.preferredMetHint}>
                      ♥ {formatDuration(w.preferredMinutes)}
                    </span>
                  )}
                  {w.avoidedMinutes > 0 && (
                    <span className="pill pill-warn" title={labels.avoidedWorkedHint}>
                      ✕ {formatDuration(w.avoidedMinutes)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}

function CoverageBanner({
  analysis,
  shifts,
}: {
  analysis: ScheduleAnalysis;
  shifts: Shift[];
}) {
  const { t, fmt, range, weekday } = useI18n();
  const shiftById = new Map(shifts.map((s) => [s.id, s]));
  const { gaps, conflicts } = analysis;

  if (gaps.length === 0 && conflicts.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-[var(--r-md)] border border-ok-line bg-ok-soft px-3 py-2 text-base text-ok">
        <span aria-hidden>✓</span>
        {t.schedule.coverageOk}
      </p>
    );
  }

  const critical = gaps.filter((g) => g.critical);
  const soft = gaps.filter((g) => !g.critical);

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">{t.schedule.coverageTitle}</h2>
        {critical.length > 0 && (
          <span className="pill pill-danger">{critical.length}</span>
        )}
        {soft.length > 0 && <span className="pill pill-warn">{soft.length}</span>}
      </div>

      {conflicts.length > 0 && (
        <p className="border-b border-danger-line bg-danger-soft px-4 py-2 text-base text-danger">
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
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-base"
            >
              <span className={`pill ${gap.critical ? "pill-danger" : "pill-warn"}`}>
                {gap.critical ? t.schedule.criticalGap : t.schedule.idealGap}
              </span>
              <span className="font-medium">{weekday(shift.weekday)}</span>
              <span className="text-muted">{shift.name}</span>
              <span className="num text-xs text-faint">
                {range(shift.startMin, shift.endMin)}
              </span>
              <span className="num ml-auto text-xs text-muted">
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
