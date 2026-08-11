"use client";

import { useMemo, useTransition } from "react";

import {
  addShiftSegment,
  createShift,
  deleteShiftGroup,
  setShiftWeekday,
  updateShiftGroup,
} from "@/app/actions";
import { TimeField } from "@/components/PeopleEditor";
import { useI18n } from "@/lib/i18n/context";
import { SCHOOL_WEEKDAYS, type Shift, type Weekday } from "@/lib/types";

/**
 * A shift *name* (e.g. "Recess") can run as several non-overlapping
 * *segments* — different weekdays at different times or headcounts, such as a
 * shorter Thursday. Segments are grouped here by (start, end); which weekday
 * belongs to which segment is enforced server-side so the same day can never
 * appear in two segments of the same name at once.
 */
interface Segment {
  key: string;
  ids: number[];
  startMin: number;
  endMin: number;
  requiredMin: number;
  requiredIdeal: number;
  active: boolean;
  weekdays: Set<Weekday>;
}

interface NameGroup {
  name: string;
  segments: Segment[];
}

function groupShifts(shifts: Shift[]): NameGroup[] {
  const byName = new Map<string, Map<string, Segment>>();
  for (const shift of shifts) {
    let segments = byName.get(shift.name);
    if (!segments) {
      segments = new Map();
      byName.set(shift.name, segments);
    }
    const key = `${shift.startMin}|${shift.endMin}`;
    let segment = segments.get(key);
    if (!segment) {
      segment = {
        key,
        ids: [],
        startMin: shift.startMin,
        endMin: shift.endMin,
        requiredMin: shift.requiredMin,
        requiredIdeal: shift.requiredIdeal,
        active: shift.active,
        weekdays: new Set(),
      };
      segments.set(key, segment);
    }
    segment.ids.push(shift.id);
    segment.weekdays.add(shift.weekday);
  }

  return [...byName.entries()]
    .map(([name, segments]) => ({
      name,
      segments: [...segments.values()].sort(
        (a, b) => a.startMin - b.startMin || a.endMin - b.endMin,
      ),
    }))
    .sort((a, b) => a.segments[0].startMin - b.segments[0].startMin);
}

export function ShiftsEditor({
  scheduleId,
  shifts,
}: {
  scheduleId: number;
  shifts: Shift[];
}) {
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
                void createShift(scheduleId, {
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
            <NameGroupCard
              key={group.name}
              scheduleId={scheduleId}
              group={group}
              pending={pending}
              run={startTransition}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-faint">{t.shifts.groupHint}</p>
      <p className="text-xs text-faint">{t.shifts.segmentHint}</p>
    </div>
  );
}

function NameGroupCard({
  scheduleId,
  group,
  pending,
  run,
}: {
  scheduleId: number;
  group: NameGroup;
  pending: boolean;
  run: (fn: () => void) => void;
}) {
  const { t } = useI18n();
  const totalDays = new Set(group.segments.flatMap((s) => [...s.weekdays])).size;
  const canSplit = totalDays > 1 || group.segments.length > 1;

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line bg-raised/50 px-4 py-2.5">
        <h2 className="text-sm font-semibold">{group.name}</h2>
        <span className="pill">
          {totalDays} {t.shifts.days}
        </span>
        <button
          type="button"
          className="btn btn-sm ml-auto"
          title={canSplit ? t.hints.addSegment : t.hints.addSegmentDisabled}
          disabled={pending || !canSplit}
          onClick={() => run(() => void addShiftSegment(scheduleId, group.name))}
        >
          + {t.shifts.addSegment}
        </button>
      </div>

      <div className="divide-y divide-line">
        {group.segments.map((segment) => (
          <SegmentRow
            key={segment.key}
            scheduleId={scheduleId}
            name={group.name}
            segment={segment}
            /** So the day-toggle strip can grey out days another segment already owns. */
            takenElsewhere={new Set(
              group.segments
                .filter((s) => s.key !== segment.key)
                .flatMap((s) => [...s.weekdays]),
            )}
            onlySegment={group.segments.length === 1}
            pending={pending}
            run={run}
          />
        ))}
      </div>
    </section>
  );
}

function SegmentRow({
  scheduleId,
  name,
  segment,
  takenElsewhere,
  onlySegment,
  pending,
  run,
}: {
  scheduleId: number;
  name: string;
  segment: Segment;
  takenElsewhere: Set<Weekday>;
  onlySegment: boolean;
  pending: boolean;
  run: (fn: () => void) => void;
}) {
  const { t, weekday, range } = useI18n();

  const patch = (changes: Partial<Segment>) => {
    const next = { ...segment, ...changes };
    run(() =>
      void updateShiftGroup(scheduleId, segment.ids, {
        name,
        startMin: next.startMin,
        endMin: next.endMin,
        requiredMin: next.requiredMin,
        requiredIdeal: next.requiredIdeal,
        active: next.active,
      }),
    );
  };

  const onlyDayInSegment = segment.weekdays.size <= 1;

  return (
    <div className="flex flex-wrap items-end gap-3 px-4 py-3">
      <div>
        <label className="label">{t.common.from}</label>
        <TimeField
          value={segment.startMin}
          disabled={pending}
          onCommit={(startMin) => patch({ startMin })}
        />
      </div>

      <div>
        <label className="label">{t.common.to}</label>
        <TimeField
          value={segment.endMin}
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
          value={segment.requiredMin}
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
          value={segment.requiredIdeal}
          disabled={pending}
          onChange={(e) => patch({ requiredIdeal: Number(e.target.value) })}
        />
      </div>

      <div>
        <label className="label">{t.shifts.runsOn}</label>
        <div className="flex gap-1">
          {SCHOOL_WEEKDAYS.map((day) => {
            const on = segment.weekdays.has(day);
            const ownedElsewhere = !on && takenElsewhere.has(day);
            // Refuse to empty the last segment's last day — deleting the
            // segment (or the whole shift) is the explicit action for that.
            const locked = on && onlyDayInSegment && onlySegment;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                disabled={pending || locked}
                title={
                  locked
                    ? t.shifts.lastDayHint
                    : ownedElsewhere
                      ? t.hints.stealDay
                      : weekday(day)
                }
                onClick={() => run(() => void setShiftWeekday(scheduleId, segment.ids, day, !on))}
                className={`h-8 w-9 rounded-[var(--r-sm)] border text-2xs font-semibold transition ${
                  on
                    ? "border-accent bg-accent-soft text-accent"
                    : ownedElsewhere
                      ? "border-line border-dashed bg-raised text-faint hover:border-warn-line hover:text-warn"
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
          checked={segment.active}
          disabled={pending}
          onChange={(e) => patch({ active: e.target.checked })}
        />
        {t.common.active}
      </label>

      <span className="num mb-2 text-xs text-faint">{range(segment.startMin, segment.endMin)}</span>

      <button
        type="button"
        className="btn btn-ghost btn-danger btn-sm mb-1.5 ml-auto"
        title={t.hints.deleteShift}
        disabled={pending}
        onClick={() => {
          if (confirm(t.common.confirmDelete)) run(() => void deleteShiftGroup(scheduleId, segment.ids));
        }}
      >
        {t.shifts.deleteShift}
      </button>
    </div>
  );
}
