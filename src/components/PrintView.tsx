"use client";

import Link from "next/link";
import { useMemo } from "react";

import { analyzeSchedule, buildShiftRows } from "@/lib/analyze";
import { useI18n } from "@/lib/i18n/context";
import { toHours } from "@/lib/time";
import type { Assignment, AvailabilityWindow, Person, Shift, Weekday } from "@/lib/types";

interface Props {
  code: string;
  people: Person[];
  shifts: Shift[];
  availability: AvailabilityWindow[];
  assignments: Assignment[];
  weekdays: Weekday[];
}

/** Shared cell styling — thin rules read better on paper than filled cards. */
const CELL = "border border-line px-2.5 py-1.5 align-top text-sm";
const HEAD = `${CELL} bg-raised/60 text-left text-2xs font-semibold uppercase tracking-wide text-muted`;

export function PrintView({
  code,
  people,
  shifts,
  availability,
  assignments,
  weekdays,
}: Props) {
  const { t, locale, range, weekday, duration } = useI18n();

  const rows = useMemo(() => buildShiftRows(shifts), [shifts]);
  const analysis = useMemo(
    () => analyzeSchedule(people, shifts, assignments, availability),
    [people, shifts, assignments, availability],
  );
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const shiftById = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);
  const gapByShift = useMemo(
    () => new Map(analysis.gaps.map((g) => [g.shiftId, g])),
    [analysis.gaps],
  );

  return (
    <div className="space-y-7">
      <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="page-title">{t.print.title}</h1>
          <p className="mt-1 text-xs text-muted">
            {new Date().toLocaleDateString(locale, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="no-print flex gap-2">
          <Link className="btn" href={`/s/${code}`} title={t.hints.back}>
            {t.common.back}
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            title={t.hints.printNow}
            onClick={() => window.print()}
          >
            {t.print.print}
          </button>
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="section-title">{t.print.byShift}</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${HEAD} w-40`}>{t.nav.shifts}</th>
              {weekdays.map((day) => (
                <th key={day} className={HEAD}>
                  {weekday(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th className={`${CELL} bg-raised/30 text-left`}>
                  <div className="font-semibold">{row.name}</div>
                  <div className="num text-2xs font-normal text-muted">
                    {range(row.startMin, row.endMin)}
                  </div>
                </th>
                {weekdays.map((day) => {
                  const shift = row.byWeekday.get(day);
                  if (!shift) {
                    return (
                      <td key={day} className={`${CELL} text-faint/50`}>
                        ·
                      </td>
                    );
                  }
                  const names = assignments
                    .filter((a) => a.shiftId === shift.id)
                    .map((a) => personById.get(a.personId)?.name ?? "?")
                    .sort();
                  const gap = gapByShift.get(shift.id);
                  return (
                    <td key={day} className={CELL}>
                      {names.length > 0 ? (
                        <ul>
                          {names.map((name) => (
                            <li key={name}>{name}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-faint">{t.schedule.unstaffed}</span>
                      )}
                      {gap && (
                        <span
                          className={`num mt-1 inline-block text-2xs font-semibold ${
                            gap.critical ? "text-danger" : "text-warn"
                          }`}
                        >
                          {gap.assigned}/{gap.requiredIdeal}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2 break-inside-avoid">
        <h2 className="section-title">{t.print.byPerson}</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${HEAD} w-40`}>{t.schedule.person}</th>
              {weekdays.map((day) => (
                <th key={day} className={HEAD}>
                  {weekday(day)}
                </th>
              ))}
              <th className={`${HEAD} text-right`}>{t.schedule.hours}</th>
            </tr>
          </thead>
          <tbody>
            {people
              .filter((p) => p.active)
              .map((person) => {
                const workload = analysis.workloads.find((w) => w.personId === person.id);
                return (
                  <tr key={person.id}>
                    <th className={`${CELL} bg-raised/30 text-left font-semibold`}>
                      {person.name}
                    </th>
                    {weekdays.map((day) => {
                      const mine = assignments
                        .filter((a) => a.personId === person.id)
                        .map((a) => shiftById.get(a.shiftId))
                        .filter((s): s is Shift => Boolean(s) && s!.weekday === day)
                        .sort((a, b) => a.startMin - b.startMin);
                      return (
                        <td key={day} className={`${CELL} num text-xs`}>
                          {mine.length === 0 ? (
                            <span className="text-faint/50">·</span>
                          ) : (
                            // Consecutive shifts read better as one block of time.
                            mergeBlocks(mine).map((block, i) => (
                              <div key={i}>{range(block[0], block[1])}</div>
                            ))
                          )}
                        </td>
                      );
                    })}
                    <td className={`${CELL} num text-right font-semibold`}>
                      {toHours(workload?.totalMinutes ?? 0)} h
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        <p className="text-xs text-muted">
          {t.schedule.spread} <span className="num">{duration(analysis.spreadMinutes)}</span>
          {" · "}
          {t.schedule.totalStaffed}{" "}
          <span className="num">{duration(analysis.totalStaffedMinutes)}</span>
        </p>
      </section>
    </div>
  );
}

/** Collapse touching or overlapping shifts into single [start, end] ranges. */
function mergeBlocks(shifts: Shift[]): [number, number][] {
  const blocks: [number, number][] = [];
  for (const shift of shifts) {
    const last = blocks.at(-1);
    if (last && shift.startMin <= last[1]) {
      last[1] = Math.max(last[1], shift.endMin);
    } else {
      blocks.push([shift.startMin, shift.endMin]);
    }
  }
  return blocks;
}
