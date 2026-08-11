"use client";

import Link from "next/link";
import { useState, useMemo, useTransition } from "react";

import {
  addAssignment,
  clearPins,
  generateSchedule,
  removeAssignment,
  togglePin,
} from "@/app/actions";
import { AddPersonMenu } from "@/components/schedule/AddPersonMenu";
import { MobileSchedule } from "@/components/schedule/MobileSchedule";
import { personColor } from "@/components/schedule/person-hue";
import { analyzeSchedule, buildShiftRows, type ScheduleAnalysis } from "@/lib/analyze";
import { useI18n } from "@/lib/i18n/context";
import { toHours } from "@/lib/time";
import type {
  Assignment,
  AvailabilityWindow,
  Person,
  Shift,
  SolverSettings,
  Weekday,
} from "@/lib/types";

interface Props {
  people: Person[];
  shifts: Shift[];
  availability: AvailabilityWindow[];
  assignments: Assignment[];
  /** Weekdays that have at least one shift, in order. */
  weekdays: Weekday[];
  settings: SolverSettings;
  scheduleId: number;
  code: string;
  /** False for a view-only visitor: every editing affordance is hidden. */
  canEdit: boolean;
}

export function ScheduleView({
  people,
  shifts,
  availability,
  assignments,
  weekdays,
  settings,
  scheduleId,
  code,
  canEdit,
}: Props) {
  const { t, fmt, range, duration, weekday } = useI18n();
  const [pending, startTransition] = useTransition();

  const analysis = useMemo(
    () => analyzeSchedule(people, shifts, assignments, availability, settings),
    [people, shifts, assignments, availability, settings],
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
  /** Assignments that no longer fit availability, keyed for a cheap lookup. */
  const conflictKeys = useMemo(
    () => new Set(analysis.conflicts.map((a) => `${a.shiftId}:${a.personId}`)),
    [analysis.conflicts],
  );

  /** Everyone whose availability covers this shift end to end. */
  const candidatesFor = useMemo(() => {
    const windowsByPerson = new Map<number, AvailabilityWindow[]>();
    for (const w of availability) {
      const list = windowsByPerson.get(w.personId);
      if (list) list.push(w);
      else windowsByPerson.set(w.personId, [w]);
    }
    return (shift: Shift) =>
      people.filter(
        (p) =>
          p.active &&
          (windowsByPerson.get(p.id) ?? []).some(
            (w) =>
              w.weekday === shift.weekday &&
              w.startMin <= shift.startMin &&
              w.endMin >= shift.endMin,
          ),
      );
  }, [people, availability]);

  const hasSchedule = assignments.length > 0;
  const pinnedCount = assignments.filter((a) => a.pinned).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{t.schedule.title}</h1>
          <p className="mt-1 text-base text-muted">{t.schedule.subtitle}</p>
        </div>
        {/* On a phone the primary action leads and takes the full width, and
            the rest share the row below it; `order` puts them back in the
            desktop sequence from `md` up rather than duplicating the markup. */}
        <div className="no-print flex w-full flex-wrap items-center gap-2 md:w-auto">
          {canEdit && pinnedCount > 0 && (
            <button
              type="button"
              className="btn order-2 grow basis-[calc(50%-0.25rem)] md:order-1 md:grow-0 md:basis-auto"
              title={t.hints.clearPins}
              disabled={pending}
              onClick={() => {
                if (confirm(t.schedule.confirmClearPins)) {
                  startTransition(() => void clearPins(scheduleId));
                }
              }}
            >
              {t.schedule.clearPins}
              <span className="pill pill-neutral">{pinnedCount}</span>
            </button>
          )}
          <Link
            className="btn order-3 grow basis-[calc(50%-0.25rem)] md:order-2 md:grow-0 md:basis-auto"
            href={`/s/${code}/print`}
            title={t.hints.print}
          >
            {t.nav.print}
          </Link>
          {canEdit && (
          <button
            type="button"
            className="btn btn-primary order-1 basis-full md:order-3 md:basis-auto"
            title={t.hints.generate}
            disabled={pending}
            onClick={() => {
              // Nothing to lose on the very first generate — only confirm
              // when this button is actually replacing an existing schedule.
              if (!hasSchedule || confirm(t.schedule.confirmGenerate)) {
                startTransition(() => void generateSchedule(scheduleId));
              }
            }}
          >
            {pending
              ? t.schedule.generating
              : hasSchedule
                ? t.schedule.regenerate
                : t.schedule.generate}
          </button>
          )}
        </div>
      </header>

      {!hasSchedule ? (
        <div className="card grid place-items-center gap-3 px-6 py-16 text-center">
          <p className="text-base text-muted">
            {canEdit ? t.schedule.empty : t.schedule.emptyViewer}
          </p>
          {canEdit && (
            <button
              type="button"
              className="btn btn-primary"
              title={t.hints.generate}
              disabled={pending}
              onClick={() => startTransition(() => void generateSchedule(scheduleId))}
            >
              {t.schedule.generate}
            </button>
          )}
        </div>
      ) : (
        <>
          <CoverageBanner analysis={analysis} shifts={shifts} people={people} />

          <MobileSchedule
            weekdays={weekdays}
            shifts={shifts}
            assignments={assignments}
            people={people}
            hueOf={hueOf}
            gapByShift={gapByShift}
            conflictKeys={conflictKeys}
            candidatesFor={candidatesFor}
            canEdit={canEdit}
            pending={pending}
            onTogglePin={(shiftId, personId) =>
              startTransition(() => void togglePin(scheduleId, shiftId, personId))
            }
            onRemove={(shiftId, personId) =>
              startTransition(() => void removeAssignment(scheduleId, shiftId, personId))
            }
            onAdd={(shiftId, personId) =>
              startTransition(() => void addAssignment(scheduleId, shiftId, personId))
            }
          />

          {/* The matrix is the right shape for a wide screen and the wrong one
              for a phone; both are rendered and one is hidden, which for five
              days of a handful of shifts is cheaper than a media-query hook. */}
          <div className="card hidden overflow-x-auto md:block">
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
                            className={`group/cell flex flex-col gap-0.5 rounded-[var(--r-md)] border-l-2 py-1 pr-1 pl-1.5 ${
                              gap?.critical
                                ? "border-l-[var(--c-danger)] bg-danger-soft/45"
                                : gap
                                  ? "border-l-[var(--c-warn)] bg-warn-soft/40"
                                  : "border-l-transparent"
                            }`}
                          >
                            {staff.map((a) => !canEdit ? (
                              <span
                                key={a.personId}
                                data-person={hueOf.get(a.personId) ?? 0}
                                className="chip cursor-default"
                              >
                                <span aria-hidden className="chip-dot" />
                                <span className="truncate">
                                  {personById.get(a.personId)?.name ?? "?"}
                                </span>
                              </span>
                            ) : (
                              <div key={a.personId} className="group/chip flex items-center">
                                <button
                                  type="button"
                                  disabled={pending}
                                  data-person={hueOf.get(a.personId) ?? 0}
                                  data-pinned={a.pinned}
                                  title={a.pinned ? t.hints.unpinChip : t.hints.pinChip}
                                  onClick={() =>
                                    startTransition(
                                      () => void togglePin(scheduleId, shift.id, a.personId),
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
                                <button
                                  type="button"
                                  disabled={pending}
                                  title={t.hints.removeFromShift}
                                  aria-label={t.schedule.removePerson}
                                  onClick={() =>
                                    startTransition(
                                      () => void removeAssignment(scheduleId, shift.id, a.personId),
                                    )
                                  }
                                  className="ml-0.5 shrink-0 rounded-[3px] px-1 text-2xs text-faint opacity-0 transition group-hover/chip:opacity-100 hover:bg-danger-soft hover:text-danger focus-visible:opacity-100"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}

                            {staff.length === 0 && (
                              <span className="px-1 py-0.5 text-sm text-faint/70">
                                {t.schedule.unstaffed}
                              </span>
                            )}

                            {canEdit && (
                            <AddPersonMenu
                              disabled={pending}
                              candidates={candidatesFor(shift).filter(
                                (p) => !staff.some((a) => a.personId === p.id),
                              )}
                              hueOf={hueOf}
                              onAdd={(personId) =>
                                startTransition(
                                  () => void addAssignment(scheduleId, shift.id, personId),
                                )
                              }
                            />
                            )}

                            <span
                              title={
                                gap
                                  ? fmt(
                                      gap.critical
                                        ? t.schedule.criticalGapHint
                                        : t.schedule.idealGapHint,
                                      { assigned: gap.assigned, ideal: gap.requiredIdeal },
                                    )
                                  : fmt(t.schedule.fullyStaffedHint, {
                                      assigned: staff.length,
                                      ideal: shift.requiredIdeal,
                                    })
                              }
                              className={`pill mt-0.5 self-start cursor-help ${
                                gap?.critical
                                  ? "pill-danger"
                                  : gap
                                    ? "pill-warn"
                                    : "pill-ok"
                              }`}
                            >
                              <span aria-hidden>
                                {gap?.critical ? "▾" : gap ? "!" : "✓"}
                              </span>
                              <span className="num">
                                {staff.length}/{shift.requiredIdeal}
                              </span>
                            </span>
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
        <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-xs text-muted">
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
              /* Under `md` the three columns become three stacked rows: a
                 name that is allowed to wrap rather than be clipped, a
                 full-width meter, and the counters wrapping under it. */
              <div
                key={w.personId}
                className="flex flex-col gap-1.5 px-4 py-2.5 md:grid md:grid-cols-[8.5rem_1fr_auto] md:items-center md:gap-4"
              >
                <div className="flex min-w-0 items-center gap-2 md:truncate">
                  <span
                    aria-hidden
                    className="chip-dot"
                    style={{ background: personColor(hue) }}
                  />
                  <span className="text-sm font-medium md:truncate">{person.name}</span>
                  {!person.active && (
                    <span className="pill pill-neutral">{labels.inactive}</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-[var(--r-full)] bg-raised">
                    <div
                      className="h-full rounded-[var(--r-full)]"
                      style={{
                        width: `${(w.totalMinutes / scale) * 100}%`,
                        background: personColor(hue),
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
                    className={`num w-16 shrink-0 text-right text-sm font-medium ${
                      overMean ? "text-foreground" : "text-muted"
                    }`}
                  >
                    {formatHours(w.totalMinutes)}
                  </span>
                </div>

                <div className="num flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-faint">
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
  people,
}: {
  analysis: ScheduleAnalysis;
  shifts: Shift[];
  people: Person[];
}) {
  const { t, fmt, range, weekday } = useI18n();
  const shiftById = new Map(shifts.map((s) => [s.id, s]));
  const { gaps, conflicts, violations } = analysis;
  // Collapsed by default: every gap already has its own icon in the grid, so
  // this list is supplementary detail, not the primary signal.
  const [expanded, setExpanded] = useState(false);

  if (gaps.length === 0 && conflicts.length === 0 && violations.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-[var(--r-md)] border border-ok-line bg-ok-soft px-3 py-2 text-base text-ok">
        <span aria-hidden>✓</span>
        {t.schedule.coverageOk}
      </p>
    );
  }

  const critical = gaps.filter((g) => g.critical);
  const soft = gaps.filter((g) => !g.critical);

  const hasList = gaps.length > 0;

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        disabled={!hasList}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 border-b border-line px-3 py-2.5 text-left disabled:cursor-default md:px-4"
      >
        <h2 className="text-sm font-semibold">{t.schedule.coverageTitle}</h2>
        {critical.length > 0 && (
          <span className="pill pill-danger">{critical.length}</span>
        )}
        {soft.length > 0 && <span className="pill pill-warn">{soft.length}</span>}
        {hasList && (
          <span aria-hidden className="ml-auto text-faint">
            {expanded ? "▴" : "▾"}
          </span>
        )}
      </button>

      {conflicts.length > 0 && (
        <p className="border-b border-danger-line bg-danger-soft px-4 py-2 text-base text-danger">
          {fmt(t.schedule.conflicts, { count: conflicts.length })}
        </p>
      )}

      {violations.length > 0 && (
        <ul className="border-b border-warn-line bg-warn-soft px-4 py-2 text-base text-warn">
          {violations.map((v, i) => (
            <li key={i}>
              {v.kind === "gap"
                ? fmt(t.schedule.gapTooLong, {
                    person: people.find((p) => p.id === v.personId)?.name ?? "?",
                    minutes: v.minutes,
                    day: weekday(v.weekday),
                  })
                : fmt(t.schedule.overlaps, {
                    person: people.find((p) => p.id === v.personId)?.name ?? "?",
                    day: weekday(v.weekday),
                  })}
            </li>
          ))}
        </ul>
      )}

      {expanded && (
        <ul className="divide-y divide-line">
          {[...critical, ...soft].map((gap) => {
            const shift = shiftById.get(gap.shiftId);
            if (!shift) return null;
            return (
              <li
                key={gap.shiftId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-base md:px-4"
              >
                <span className={`pill ${gap.critical ? "pill-danger" : "pill-warn"}`}>
                  {gap.critical ? t.schedule.criticalGap : t.schedule.idealGap}
                </span>
                <span className="font-medium">{weekday(shift.weekday)}</span>
                <span className="min-w-0 text-muted">{shift.name}</span>
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
      )}
    </section>
  );
}
