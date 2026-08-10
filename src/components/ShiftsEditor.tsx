"use client";

import { useMemo, useState, useTransition } from "react";

import { createShift, deleteShift, updateShift } from "@/app/actions";
import { TimeField } from "@/components/PeopleEditor";
import { useI18n } from "@/lib/i18n/context";
import { SCHOOL_WEEKDAYS, type Shift, type Weekday } from "@/lib/types";

export function ShiftsEditor({ shifts }: { shifts: Shift[] }) {
  const { t, weekday } = useI18n();
  const [pending, startTransition] = useTransition();

  const byWeekday = useMemo(() => {
    const map = new Map<Weekday, Shift[]>();
    for (const shift of shifts) {
      const list = map.get(shift.weekday);
      if (list) list.push(shift);
      else map.set(shift.weekday, [shift]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startMin - b.startMin);
    return map;
  }, [shifts]);

  const days = SCHOOL_WEEKDAYS.filter(
    (d) => (byWeekday.get(d)?.length ?? 0) > 0,
  ).concat(SCHOOL_WEEKDAYS.filter((d) => (byWeekday.get(d)?.length ?? 0) === 0));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t.shifts.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.shifts.subtitle}</p>
      </header>

      {shifts.length === 0 && (
        <p className="card p-8 text-center text-sm text-muted">{t.shifts.emptyState}</p>
      )}

      <div className="space-y-4">
        {days.map((day) => {
          const list = byWeekday.get(day) ?? [];
          return (
            <section key={day} className="card">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="font-medium">{weekday(day)}</h2>
                <button
                  type="button"
                  className="btn"
                  disabled={pending}
                  onClick={() =>
                    startTransition(
                      () =>
                        void createShift({
                          name: t.shifts.newShift,
                          weekday: day,
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
              </div>

              {list.length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted">{t.common.none}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {list.map((shift) => (
                    <ShiftRowEditor
                      key={shift.id}
                      shift={shift}
                      pending={pending}
                      run={startTransition}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ShiftRowEditor({
  shift,
  pending,
  run,
}: {
  shift: Shift;
  pending: boolean;
  run: (fn: () => void) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(shift.name);

  const patch = (changes: Partial<Shift>) => {
    const next = { ...shift, ...changes };
    run(() =>
      void updateShift(shift.id, {
        name: next.name,
        weekday: next.weekday,
        startMin: next.startMin,
        endMin: next.endMin,
        requiredMin: next.requiredMin,
        requiredIdeal: next.requiredIdeal,
        active: next.active,
      }),
    );
  };

  return (
    <li className="flex flex-wrap items-end gap-3 px-4 py-3">
      <div>
        <label className="label mb-1">{t.common.name}</label>
        <input
          className="field w-48"
          value={name}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim();
            if (!trimmed || trimmed === shift.name) return setName(shift.name);
            patch({ name: trimmed });
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </div>

      <div>
        <label className="label mb-1">{t.common.from}</label>
        <TimeField
          value={shift.startMin}
          disabled={pending}
          onCommit={(startMin) => patch({ startMin })}
        />
      </div>

      <div>
        <label className="label mb-1">{t.common.to}</label>
        <TimeField
          value={shift.endMin}
          disabled={pending}
          onCommit={(endMin) => patch({ endMin })}
        />
      </div>

      <div>
        <label className="label mb-1" title={t.shifts.requiredMinHint}>
          {t.shifts.requiredMin}
        </label>
        <input
          type="number"
          min={0}
          className="field w-20 tabular-nums"
          value={shift.requiredMin}
          disabled={pending}
          onChange={(e) => patch({ requiredMin: Number(e.target.value) })}
        />
      </div>

      <div>
        <label className="label mb-1" title={t.shifts.requiredIdealHint}>
          {t.shifts.requiredIdeal}
        </label>
        <input
          type="number"
          min={0}
          className="field w-20 tabular-nums"
          value={shift.requiredIdeal}
          disabled={pending}
          onChange={(e) => patch({ requiredIdeal: Number(e.target.value) })}
        />
      </div>

      <label className="mb-2 flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={shift.active}
          disabled={pending}
          onChange={(e) => patch({ active: e.target.checked })}
        />
        {t.common.active}
      </label>

      <button
        type="button"
        className="btn btn-ghost mb-1 ml-auto"
        disabled={pending}
        onClick={() => {
          if (confirm(t.common.confirmDelete)) run(() => void deleteShift(shift.id));
        }}
      >
        {t.shifts.deleteShift}
      </button>
    </li>
  );
}
