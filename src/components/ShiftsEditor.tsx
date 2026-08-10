"use client";

import { useMemo, useState, useTransition } from "react";

import {
  createShift,
  deleteShiftGroup,
  setShiftWeekday,
  updateShiftGroup,
} from "@/app/actions";
import { TimeField } from "@/components/PeopleEditor";
import { useI18n } from "@/lib/i18n/context";
import { SCHOOL_WEEKDAYS, type Shift, type Weekday } from "@/lib/types";

/**
 * The same slot usually runs on several weekdays with identical times. Editing
 * it once per day was both repetitive and easy to get inconsistent, so the
 * screen groups by (name, start, end) and exposes the days as toggles.
 */
interface ShiftGroup {
  key: string;
  ids: number[];
  name: string;
  startMin: number;
  endMin: number;
  requiredMin: number;
  requiredIdeal: number;
  active: boolean;
  weekdays: Set<Weekday>;
}

function groupShifts(shifts: Shift[]): ShiftGroup[] {
  const groups = new Map<string, ShiftGroup>();
  for (const shift of shifts) {
    const key = `${shift.name}|${shift.startMin}|${shift.endMin}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        ids: [],
        name: shift.name,
        startMin: shift.startMin,
        endMin: shift.endMin,
        requiredMin: shift.requiredMin,
        requiredIdeal: shift.requiredIdeal,
        active: shift.active,
        weekdays: new Set(),
      };
      groups.set(key, group);
    }
    group.ids.push(shift.id);
    group.weekdays.add(shift.weekday);
  }
  return [...groups.values()].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
}

export function ShiftsEditor({ shifts }: { shifts: Shift[] }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const groups = useMemo(() => groupShifts(shifts), [shifts]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{t.shifts.title}</h1>
          <p className="mt-1 text-base text-muted">{t.shifts.subtitle}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          title={t.hints.addShift}
          disabled={pending}
          onClick={() =>
            startTransition(
              () =>
                void createShift({
                  name: t.shifts.newShift,
                  weekday: 1,
                  startMin: 12 * 60,
                  endMin: 13 * 60,
                  requiredMin: 1,
                  requiredIdeal: 1,
                }),
            )
          }
        >
          + {t.shifts.addShift}
        </button>
      </header>

      {groups.length === 0 ? (
        <p className="card px-6 py-16 text-center text-base text-muted">
          {t.shifts.emptyState}
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <ShiftGroupCard
              key={group.key}
              group={group}
              pending={pending}
              run={startTransition}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-faint">{t.shifts.groupHint}</p>
    </div>
  );
}

function ShiftGroupCard({
  group,
  pending,
  run,
}: {
  group: ShiftGroup;
  pending: boolean;
  run: (fn: () => void) => void;
}) {
  const { t, weekday, range } = useI18n();
  const [name, setName] = useState(group.name);

  const patch = (changes: Partial<ShiftGroup>) => {
    const next = { ...group, ...changes };
    run(() =>
      void updateShiftGroup(group.ids, {
        name: next.name,
        startMin: next.startMin,
        endMin: next.endMin,
        requiredMin: next.requiredMin,
        requiredIdeal: next.requiredIdeal,
        active: next.active,
      }),
    );
  };

  const onlyDay = group.weekdays.size <= 1;

  return (
    <section className={`card overflow-hidden ${group.active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-raised/50 px-4 py-2.5">
        <h2 className="text-sm font-semibold">{group.name}</h2>
        <span className="num text-xs text-faint">
          {range(group.startMin, group.endMin)}
        </span>
        <span className="pill">
          {group.weekdays.size} {t.shifts.days}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-danger btn-sm ml-auto"
          title={t.hints.deleteShift}
          disabled={pending}
          onClick={() => {
            if (confirm(t.common.confirmDelete)) run(() => void deleteShiftGroup(group.ids));
          }}
        >
          {t.shifts.deleteShift}
        </button>
      </div>

      {/* Labels appear once per shift, not once per weekday. */}
      <div className="flex flex-wrap items-end gap-3 px-4 py-3">
        <div className="w-44">
          <label className="label">{t.common.name}</label>
          <input
            className="field"
            value={name}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const trimmed = name.trim();
              if (!trimmed || trimmed === group.name) return setName(group.name);
              patch({ name: trimmed });
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </div>

        <div>
          <label className="label">{t.common.from}</label>
          <TimeField
            value={group.startMin}
            disabled={pending}
            onCommit={(startMin) => patch({ startMin })}
          />
        </div>

        <div>
          <label className="label">{t.common.to}</label>
          <TimeField
            value={group.endMin}
            disabled={pending}
            onCommit={(endMin) => patch({ endMin })}
          />
        </div>

        <div className="w-20">
          <label className="label" title={t.shifts.requiredMinHint}>
            {t.shifts.requiredMin}
          </label>
          <input
            type="number"
            min={0}
            className="field num text-right"
            value={group.requiredMin}
            disabled={pending}
            onChange={(e) => patch({ requiredMin: Number(e.target.value) })}
          />
        </div>

        <div className="w-20">
          <label className="label" title={t.shifts.requiredIdealHint}>
            {t.shifts.requiredIdeal}
          </label>
          <input
            type="number"
            min={0}
            className="field num text-right"
            value={group.requiredIdeal}
            disabled={pending}
            onChange={(e) => patch({ requiredIdeal: Number(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">{t.shifts.runsOn}</label>
          <div className="flex gap-1">
            {SCHOOL_WEEKDAYS.map((day) => {
              const on = group.weekdays.has(day);
              // Refuse to empty the group — deleting is the explicit action.
              const locked = on && onlyDay;
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  disabled={pending || locked}
                  title={locked ? t.shifts.lastDayHint : weekday(day)}
                  onClick={() => run(() => void setShiftWeekday(group.ids, day, !on))}
                  className={`h-8 w-9 rounded-[var(--r-sm)] border text-2xs font-semibold transition ${
                    on
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-surface text-faint hover:border-line-strong hover:text-muted"
                  } ${locked ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  {weekday(day, "short")}
                </button>
              );
            })}
          </div>
        </div>

        <label
          className="mb-2 flex cursor-pointer items-center gap-1.5 text-base text-muted"
          title={t.hints.shiftActive}
        >
          <input
            type="checkbox"
            checked={group.active}
            disabled={pending}
            onChange={(e) => patch({ active: e.target.checked })}
          />
          {t.common.active}
        </label>
      </div>
    </section>
  );
}
