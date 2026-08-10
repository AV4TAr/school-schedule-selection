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

  // Days that already have shifts first; empty days still shown, so a new
  // shift can be added to any weekday.
  const days = SCHOOL_WEEKDAYS.filter((d) => (byWeekday.get(d)?.length ?? 0) > 0).concat(
    SCHOOL_WEEKDAYS.filter((d) => (byWeekday.get(d)?.length ?? 0) === 0),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">{t.shifts.title}</h1>
        <p className="mt-1 text-base text-muted">{t.shifts.subtitle}</p>
      </header>

      {shifts.length === 0 && (
        <p className="card px-6 py-16 text-center text-base text-muted">
          {t.shifts.emptyState}
        </p>
      )}

      <div className="space-y-3">
        {days.map((day) => {
          const list = byWeekday.get(day) ?? [];
          return (
            <section key={day} className="card overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-line bg-raised/50 px-4 py-2.5">
                <h2 className="text-sm font-semibold">{weekday(day)}</h2>
                <span className="pill pill-neutral">{list.length}</span>
                <button
                  type="button"
                  className="btn btn-sm ml-auto"
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
                <p className="px-4 py-4 text-base text-faint">{t.common.none}</p>
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
    <li
      className={`flex flex-wrap items-end gap-3 px-4 py-3 ${shift.active ? "" : "opacity-60"}`}
    >
      <div className="w-44">
        <label className="label">{t.common.name}</label>
        <input
          className="field"
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
        <label className="label">{t.common.from}</label>
        <TimeField
          value={shift.startMin}
          disabled={pending}
          onCommit={(startMin) => patch({ startMin })}
        />
      </div>

      <div>
        <label className="label">{t.common.to}</label>
        <TimeField
          value={shift.endMin}
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
          value={shift.requiredMin}
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
          value={shift.requiredIdeal}
          disabled={pending}
          onChange={(e) => patch({ requiredIdeal: Number(e.target.value) })}
        />
      </div>

      <label className="mb-2 flex cursor-pointer items-center gap-1.5 text-base text-muted">
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
        className="btn btn-ghost btn-danger btn-sm mb-1.5 ml-auto"
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
