"use client";

import { deleteAvailability, updateAvailability } from "@/app/actions";
import { PreferencePicker } from "@/components/people/PreferencePicker";
import { TimeField } from "@/components/people/TimeField";
import { useI18n } from "@/lib/i18n/context";
import {
  SCHOOL_WEEKDAYS,
  type AvailabilityWindow,
  type Preference,
  type Weekday,
} from "@/lib/types";

/**
 * One availability window.
 *
 * On a phone it stops pretending to be a row: it becomes a small bordered block
 * with the weekday on its own line, the two times side by side under `From` /
 * `To`, and a full-width preference control. From `md` up the wrappers collapse
 * to `display: contents`, which drops them out of the box tree entirely, so the
 * fields land in one flex row exactly as they did before — same DOM order, no
 * duplicated controls, and no JS branch on viewport width.
 */
export function AvailabilityWindowRow({
  scheduleId,
  window: w,
  pending,
  run,
}: {
  scheduleId: number;
  window: AvailabilityWindow;
  pending: boolean;
  run: (fn: () => void) => void;
}) {
  const { t, weekday } = useI18n();

  return (
    <li className="flex flex-col gap-2 rounded-md border border-line p-3 md:flex-row md:flex-wrap md:items-center md:gap-1.5 md:rounded-none md:border-0 md:p-0">
      <div className="md:contents">
        <span className="label md:hidden">{t.common.day}</span>
        <select
          className="field md:w-32"
          value={w.weekday}
          disabled={pending}
          aria-label={t.common.day}
          onChange={(e) =>
            run(() =>
              void updateAvailability(scheduleId, w.id, {
                weekday: Number(e.target.value) as Weekday,
              }),
            )
          }
        >
          {SCHOOL_WEEKDAYS.map((d) => (
            <option key={d} value={d}>
              {weekday(d)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 items-end gap-2 md:contents">
        <div className="md:contents">
          <span className="label md:hidden">{t.common.from}</span>
          <TimeField
            className="field num w-full md:w-26"
            value={w.startMin}
            disabled={pending}
            onCommit={(startMin) => run(() => void updateAvailability(scheduleId, w.id, { startMin }))}
          />
        </div>
        <span aria-hidden className="hidden text-faint md:inline">
          →
        </span>
        <div className="md:contents">
          <span className="label md:hidden">{t.common.to}</span>
          <TimeField
            className="field num w-full md:w-26"
            value={w.endMin}
            disabled={pending}
            onCommit={(endMin) => run(() => void updateAvailability(scheduleId, w.id, { endMin }))}
          />
        </div>
      </div>

      <PreferencePicker
        value={w.preference}
        disabled={pending}
        onChange={(preference: Preference) =>
          run(() => void updateAvailability(scheduleId, w.id, { preference }))
        }
      />

      <button
        type="button"
        className="btn btn-ghost btn-danger w-full md:w-auto md:px-2 md:py-1 md:text-xs"
        disabled={pending}
        aria-label={t.common.delete}
        title={t.hints.deleteWindow}
        onClick={() => run(() => void deleteAvailability(scheduleId, w.id))}
      >
        <span aria-hidden>✕</span>
        <span className="md:hidden">{t.people.deleteWindow}</span>
      </button>
    </li>
  );
}
