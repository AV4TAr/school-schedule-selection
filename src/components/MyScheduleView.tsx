"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useI18n } from "@/lib/i18n/context";
import { LOCALES, type Locale } from "@/lib/i18n/dictionaries";
import { toHours } from "@/lib/time";
import { SCHOOL_WEEKDAYS, type Assignment, type Person, type Shift, type Weekday } from "@/lib/types";

const LOCALE_CODE: Record<Locale, string> = { en: "EN", es: "ES" };

/** Today, mapped onto the Mon–Fri school week. Weekends fall back to Monday. */
function todayAsSchoolWeekday(): Weekday {
  const jsDay = new Date().getDay(); // 0 = Sunday .. 6 = Saturday
  return jsDay >= 1 && jsDay <= 5 ? (jsDay as Weekday) : 1;
}

interface Props {
  code: string;
  scheduleName: string;
  people: Person[];
  shifts: Shift[];
  assignments: Assignment[];
}

/**
 * Staff-facing read-only view: no admin nav, no editing controls. Identity is
 * plain component state — it resets on every fresh page load (asking again
 * each visit, by design) but survives day/week/scope toggles within the
 * session since those don't remount this component.
 */
export function MyScheduleView({
  code,
  scheduleName,
  people,
  shifts,
  assignments,
}: Props) {
  const [personId, setPersonId] = useState<number | null>(null);

  const hueOf = useMemo(
    () => new Map(people.map((p, i) => [p.id, (i + 1) % 6])),
    [people],
  );

  if (personId === null) {
    return (
      <IdentityPicker
        scheduleName={scheduleName}
        people={people}
        hueOf={hueOf}
        onPick={setPersonId}
      />
    );
  }

  const person = people.find((p) => p.id === personId);
  if (!person) {
    // The person was deactivated mid-session — fall back to the picker
    // rather than showing a broken view.
    setPersonId(null);
    return null;
  }

  return (
    <Schedule
      code={code}
      person={person}
      people={people}
      shifts={shifts}
      assignments={assignments}
      hueOf={hueOf}
      onChangePerson={() => setPersonId(null)}
    />
  );
}

function IdentityPicker({
  scheduleName,
  people,
  hueOf,
  onPick,
}: {
  scheduleName: string;
  people: Person[];
  hueOf: Map<number, number>;
  onPick: (id: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <span
          aria-hidden
          className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-[var(--r-md)] bg-accent text-sm font-bold text-accent-fg"
        >
          SS
        </span>
        <p className="mb-1 text-xs text-muted">{scheduleName}</p>
        <h1 className="page-title">{t.mySchedule.whoAreYou}</h1>
      </div>
      <div className="space-y-2.5">
        {people.map((person, i) => (
          <button
            key={person.id}
            type="button"
            onClick={() => onPick(person.id)}
            className="card flex w-full items-center gap-3 px-4 py-3.5 text-left text-base font-medium transition active:scale-[0.98]"
          >
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-full"
              style={{
                background: `var(--c-p${(hueOf.get(person.id) ?? i + 1) === 0 ? 6 : (hueOf.get(person.id) ?? i + 1)})`,
              }}
            />
            {person.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Schedule({
  code,
  person,
  people,
  shifts,
  assignments,
  hueOf,
  onChangePerson,
}: {
  code: string;
  person: Person;
  people: Person[];
  shifts: Shift[];
  assignments: Assignment[];
  hueOf: Map<number, number>;
  onChangePerson: () => void;
}) {
  const { t, locale, setLocale, weekday } = useI18n();
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [scope, setScope] = useState<"me" | "everyone">("me");
  const [selectedDay, setSelectedDay] = useState<Weekday>(() => todayAsSchoolWeekday());

  const shiftsByDay = useMemo(() => {
    const map = new Map<Weekday, Shift[]>();
    for (const shift of shifts) {
      const list = map.get(shift.weekday);
      if (list) list.push(shift);
      else map.set(shift.weekday, [shift]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startMin - b.startMin);
    return map;
  }, [shifts]);

  const assignmentsByShift = useMemo(() => {
    const map = new Map<number, Assignment[]>();
    for (const a of assignments) {
      const list = map.get(a.shiftId);
      if (list) list.push(a);
      else map.set(a.shiftId, [a]);
    }
    return map;
  }, [assignments]);

  const weeklyMinutes = useMemo(() => {
    let total = 0;
    for (const shift of shifts) {
      const staff = assignmentsByShift.get(shift.id) ?? [];
      if (staff.some((a) => a.personId === person.id)) {
        total += shift.endMin - shift.startMin;
      }
    }
    return total;
  }, [shifts, assignmentsByShift, person.id]);

  const cycleDay = (delta: 1 | -1) => {
    const idx = SCHOOL_WEEKDAYS.indexOf(selectedDay);
    const next = (idx + delta + SCHOOL_WEEKDAYS.length) % SCHOOL_WEEKDAYS.length;
    setSelectedDay(SCHOOL_WEEKDAYS[next]);
  };

  return (
    <div className="min-h-screen pb-10">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-sm items-center gap-2 px-4 py-2.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              background: `var(--c-p${(hueOf.get(person.id) ?? 0) === 0 ? 6 : (hueOf.get(person.id) ?? 0)})`,
            }}
          />
          <span className="truncate text-sm font-semibold">{person.name}</span>
          <button
            type="button"
            onClick={onChangePerson}
            className="text-xs text-muted underline underline-offset-2"
          >
            {t.mySchedule.changePerson}
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <div className="flex items-center gap-0.5 rounded-[var(--r-sm)] border border-line bg-raised p-0.5">
              {LOCALES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  aria-pressed={locale === code}
                  className={`rounded-[3px] px-1.5 py-0.5 text-2xs font-semibold transition ${
                    locale === code
                      ? "bg-surface text-foreground shadow-[var(--e-1)]"
                      : "text-faint"
                  }`}
                >
                  {LOCALE_CODE[code]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-sm space-y-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <SegmentedToggle
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: "day", label: t.mySchedule.viewDay },
              { value: "week", label: t.mySchedule.viewWeek },
            ]}
          />
          <SegmentedToggle
            value={scope}
            onChange={setScope}
            options={[
              { value: "me", label: t.mySchedule.scopeMe },
              { value: "everyone", label: t.mySchedule.scopeEveryone },
            ]}
          />
        </div>

        {scope === "me" && (
          <p className="text-center text-xs text-muted">
            {t.mySchedule.weeklyTotal}{" "}
            <span className="num font-semibold text-foreground">
              {toHours(weeklyMinutes)} h
            </span>
          </p>
        )}

        {viewMode === "day" ? (
          <>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => cycleDay(-1)}
                aria-label="Previous day"
                className="btn btn-sm h-8 w-8 px-0"
              >
                ‹
              </button>
              <div className="text-center">
                <div className="text-sm font-semibold">{weekday(selectedDay)}</div>
                {selectedDay === todayAsSchoolWeekday() && (
                  <div className="text-2xs text-accent">{t.mySchedule.today}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => cycleDay(1)}
                aria-label="Next day"
                className="btn btn-sm h-8 w-8 px-0"
              >
                ›
              </button>
            </div>

            <DayCard
              shifts={shiftsByDay.get(selectedDay) ?? []}
              assignmentsByShift={assignmentsByShift}
              people={people}
              person={person}
              scope={scope}
              hueOf={hueOf}
            />
          </>
        ) : (
          <div className="space-y-4">
            {SCHOOL_WEEKDAYS.map((day) => (
              <div key={day}>
                <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
                  {weekday(day)}
                  {day === todayAsSchoolWeekday() && (
                    <span className="ml-1.5 text-accent">· {t.mySchedule.today}</span>
                  )}
                </h2>
                <DayCard
                  shifts={shiftsByDay.get(day) ?? []}
                  assignmentsByShift={assignmentsByShift}
                  people={people}
                  person={person}
                  scope={scope}
                  hueOf={hueOf}
                />
              </div>
            ))}
          </div>
        )}

        <p className="pt-2 text-center">
          <Link href={`/s/${code}`} className="text-2xs text-faint underline underline-offset-2">
            {t.mySchedule.adminLink}
          </Link>
        </p>
      </main>
    </div>
  );
}

function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded-[var(--r-sm)] border border-line bg-raised p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`flex-1 rounded-[3px] py-1.5 text-sm font-medium transition ${
            value === opt.value
              ? "bg-surface text-foreground shadow-[var(--e-1)]"
              : "text-muted"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DayCard({
  shifts,
  assignmentsByShift,
  people,
  person,
  scope,
  hueOf,
}: {
  shifts: Shift[];
  assignmentsByShift: Map<number, Assignment[]>;
  people: Person[];
  person: Person;
  scope: "me" | "everyone";
  hueOf: Map<number, number>;
}) {
  const { t, range } = useI18n();
  const personById = new Map(people.map((p) => [p.id, p]));

  const rows = shifts
    .map((shift) => ({ shift, staff: assignmentsByShift.get(shift.id) ?? [] }))
    .filter(({ staff }) =>
      scope === "me" ? staff.some((a) => a.personId === person.id) : true,
    );

  if (rows.length === 0) {
    return (
      <p className="card px-4 py-6 text-center text-sm text-muted">
        {scope === "me" ? t.mySchedule.noShiftsDay : t.mySchedule.noShiftsDayEveryone}
      </p>
    );
  }

  return (
    <div className="card divide-y divide-line overflow-hidden">
      {rows.map(({ shift, staff }) => (
        <div key={shift.id} className="px-4 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">{shift.name}</span>
            <span className="num text-xs text-faint">
              {range(shift.startMin, shift.endMin)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {staff.length === 0 ? (
              <span className="text-xs text-faint">{t.mySchedule.unassigned}</span>
            ) : (
              staff.map((a) => {
                const staffPerson = personById.get(a.personId);
                const isSelf = a.personId === person.id;
                return (
                  <span
                    key={a.personId}
                    className={`flex items-center gap-1 text-xs ${
                      isSelf ? "font-semibold text-foreground" : "text-muted"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background: `var(--c-p${(hueOf.get(a.personId) ?? 0) === 0 ? 6 : (hueOf.get(a.personId) ?? 0)})`,
                      }}
                    />
                    {staffPerson?.name ?? "?"}
                  </span>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
