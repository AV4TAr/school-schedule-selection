"use client";

import Link from "next/link";
import { useMemo } from "react";

import { analyzeSchedule, buildShiftRows } from "@/lib/analyze";
import { useI18n } from "@/lib/i18n/context";
import { toHours } from "@/lib/time";
import type { Assignment, AvailabilityWindow, Person, Shift, Weekday } from "@/lib/types";

interface Props {
  people: Person[];
  shifts: Shift[];
  availability: AvailabilityWindow[];
  assignments: Assignment[];
  weekdays: Weekday[];
}

export function PrintView({ people, shifts, availability, assignments, weekdays }: Props) {
  const { t, locale, range, weekday, duration } = useI18n();

  const rows = useMemo(() => buildShiftRows(shifts), [shifts]);
  const analysis = useMemo(
    () => analyzeSchedule(people, shifts, assignments, availability),
    [people, shifts, assignments, availability],
  );
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const shiftById = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t.print.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {new Date().toLocaleDateString(locale, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="no-print flex gap-2">
          <Link className="btn" href="/">
            {t.common.back}
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            {t.print.print}
          </button>
        </div>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">{t.print.byShift}</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-line px-3 py-2 text-left font-medium">
                {t.nav.shifts}
              </th>
              {weekdays.map((day) => (
                <th key={day} className="border border-line px-3 py-2 text-left font-medium">
                  {weekday(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th className="border border-line px-3 py-2 text-left align-top font-medium">
                  <div>{row.name}</div>
                  <div className="text-xs font-normal text-muted tabular-nums">
                    {range(row.startMin, row.endMin)}
                  </div>
                </th>
                {weekdays.map((day) => {
                  const shift = row.byWeekday.get(day);
                  if (!shift) {
                    return (
                      <td key={day} className="border border-line px-3 py-2 text-muted/40">
                        –
                      </td>
                    );
                  }
                  const names = assignments
                    .filter((a) => a.shiftId === shift.id)
                    .map((a) => personById.get(a.personId)?.name ?? "?")
                    .sort();
                  return (
                    <td key={day} className="border border-line px-3 py-2 align-top">
                      {names.length > 0 ? (
                        names.join(", ")
                      ) : (
                        <span className="text-muted/60">{t.schedule.unstaffed}</span>
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
        <h2 className="text-sm font-semibold">{t.print.byPerson}</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-line px-3 py-2 text-left font-medium">
                {t.schedule.person}
              </th>
              {weekdays.map((day) => (
                <th key={day} className="border border-line px-3 py-2 text-left font-medium">
                  {weekday(day)}
                </th>
              ))}
              <th className="border border-line px-3 py-2 text-right font-medium">
                {t.schedule.hours}
              </th>
            </tr>
          </thead>
          <tbody>
            {people
              .filter((p) => p.active)
              .map((person) => {
                const workload = analysis.workloads.find((w) => w.personId === person.id);
                return (
                  <tr key={person.id}>
                    <th className="border border-line px-3 py-2 text-left font-medium">
                      {person.name}
                    </th>
                    {weekdays.map((day) => {
                      const mine = assignments
                        .filter((a) => a.personId === person.id)
                        .map((a) => shiftById.get(a.shiftId))
                        .filter((s): s is Shift => Boolean(s) && s!.weekday === day)
                        .sort((a, b) => a.startMin - b.startMin);
                      return (
                        <td
                          key={day}
                          className="border border-line px-3 py-2 align-top text-xs tabular-nums"
                        >
                          {mine.length === 0 ? (
                            <span className="text-muted/40">–</span>
                          ) : (
                            // Consecutive shifts read better as one block of time.
                            mergeBlocks(mine).map((block, i) => (
                              <div key={i}>{range(block[0], block[1])}</div>
                            ))
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-line px-3 py-2 text-right tabular-nums">
                      {toHours(workload?.totalMinutes ?? 0)} h
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        <p className="text-xs text-muted">
          {t.schedule.spread}: {duration(analysis.spreadMinutes)} · {t.schedule.totalStaffed}:{" "}
          {duration(analysis.totalStaffedMinutes)}
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
