"use client";

import { useState, useTransition } from "react";

import {
  createAvailability,
  createPerson,
  deleteAvailability,
  deletePerson,
  updateAvailability,
  updatePerson,
} from "@/app/actions";
import { useI18n } from "@/lib/i18n/context";
import { parseTime, toTimeInput } from "@/lib/time";
import {
  PREFERENCES,
  SCHOOL_WEEKDAYS,
  type AvailabilityWindow,
  type Person,
  type Preference,
  type Weekday,
} from "@/lib/types";

interface Props {
  people: Person[];
  availability: AvailabilityWindow[];
}

export function PeopleEditor({ people, availability }: Props) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");

  const submitNew = () => {
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    startTransition(() => void createPerson(name));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{t.people.title}</h1>
          <p className="mt-1 text-base text-muted">{t.people.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="field w-48"
            placeholder={t.people.newPerson}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNew()}
          />
          <button
            type="button"
            className="btn btn-primary"
            title={t.hints.addPerson}
            disabled={pending || !newName.trim()}
            onClick={submitNew}
          >
            {t.people.addPerson}
          </button>
        </div>
      </header>

      {people.length === 0 ? (
        <p className="card px-6 py-16 text-center text-base text-muted">
          {t.people.emptyState}
        </p>
      ) : (
        <div className="space-y-3">
          {people.map((person, index) => (
            <PersonCard
              key={person.id}
              person={person}
              hue={(index + 1) % 6}
              windows={availability.filter((w) => w.personId === person.id)}
              pending={pending}
              run={startTransition}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-faint">{t.people.windowHint}</p>
      <p className="text-xs text-faint">{t.people.preferenceHint}</p>
    </div>
  );
}

function PersonCard({
  person,
  hue,
  windows,
  pending,
  run,
}: {
  person: Person;
  hue: number;
  windows: AvailabilityWindow[];
  pending: boolean;
  run: (fn: () => void) => void;
}) {
  const { t, fmt, weekday } = useI18n();
  const [name, setName] = useState(person.name);

  // Overlaps make the effective preference ambiguous, so say so rather than
  // silently resolving it.
  const overlapping = windows.some((a) =>
    windows.some(
      (b) =>
        a.id !== b.id &&
        a.weekday === b.weekday &&
        a.startMin < b.endMin &&
        b.startMin < a.endMin,
    ),
  );

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === person.name) return setName(person.name);
    run(() => void updatePerson(person.id, { name: trimmed }));
  };

  return (
    <section className={`card overflow-hidden ${person.active ? "" : "opacity-65"}`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-raised/50 px-4 py-2.5">
        <span
          aria-hidden
          className="chip-dot"
          style={{ background: `var(--c-p${hue === 0 ? 6 : hue})` }}
        />
        <input
          className="field w-52 font-medium"
          value={name}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />

        <label
          className="flex cursor-pointer items-center gap-1.5 text-base text-muted"
          title={t.hints.personActive}
        >
          <input
            type="checkbox"
            checked={person.active}
            disabled={pending}
            onChange={(e) =>
              run(() => void updatePerson(person.id, { active: e.target.checked }))
            }
          />
          {t.common.active}
        </label>

        <span className="pill">
          {windows.length === 1
            ? t.people.windowCountOne
            : fmt(t.people.windowCountMany, { count: windows.length })}
        </span>

        <button
          type="button"
          className="btn btn-ghost btn-danger ml-auto"
          title={t.hints.deletePerson}
          disabled={pending}
          onClick={() => {
            if (confirm(t.common.confirmDelete)) run(() => void deletePerson(person.id));
          }}
        >
          {t.people.deletePerson}
        </button>
      </div>

      <div className="space-y-1.5 px-4 py-3">
        {overlapping && <p className="pill pill-warn">{t.people.overlapWarning}</p>}

        {windows.length === 0 ? (
          <p className="pill pill-warn">{t.people.noWindows}</p>
        ) : (
          <ul className="space-y-1.5">
            {windows.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-1.5">
                <select
                  className="field w-32"
                  value={w.weekday}
                  disabled={pending}
                  onChange={(e) =>
                    run(() =>
                      void updateAvailability(w.id, {
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

                <TimeField
                  value={w.startMin}
                  disabled={pending}
                  onCommit={(startMin) => run(() => void updateAvailability(w.id, { startMin }))}
                />
                <span className="text-faint">→</span>
                <TimeField
                  value={w.endMin}
                  disabled={pending}
                  onCommit={(endMin) => run(() => void updateAvailability(w.id, { endMin }))}
                />

                <PreferencePicker
                  value={w.preference}
                  disabled={pending}
                  onChange={(preference) =>
                    run(() => void updateAvailability(w.id, { preference }))
                  }
                />

                <button
                  type="button"
                  className="btn btn-ghost btn-danger btn-sm"
                  disabled={pending}
                  aria-label={t.common.delete}
                  title={t.hints.deleteWindow}
                  onClick={() => run(() => void deleteAvailability(w.id))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className="btn btn-sm mt-1"
          title={t.hints.addWindow}
          disabled={pending}
          onClick={() =>
            run(() => void createAvailability(person.id, 1, 8 * 60, 13 * 60 + 15))
          }
        >
          + {t.people.addWindow}
        </button>
      </div>
    </section>
  );
}

/** Time input that only reports a change once it parses to a valid time. */
export function TimeField({
  value,
  disabled,
  onCommit,
}: {
  value: number;
  disabled?: boolean;
  onCommit: (minutes: number) => void;
}) {
  const [draft, setDraft] = useState(toTimeInput(value));

  // Re-sync when the value changes underneath us (another edit, a reset).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(toTimeInput(value));
  }

  return (
    <input
      type="time"
      className="field num w-26"
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const parsed = parseTime(draft);
        if (parsed === null) return setDraft(toTimeInput(value));
        if (parsed !== value) onCommit(parsed);
      }}
    />
  );
}

/**
 * Three-way soft preference for one availability window. Deliberately separate
 * from *whether* the person can work: removing the window is how you say no.
 */
function PreferencePicker({
  value,
  disabled,
  onChange,
}: {
  value: Preference;
  disabled?: boolean;
  onChange: (value: Preference) => void;
}) {
  const { t } = useI18n();
  const tone: Record<Preference, string> = {
    preferred: "border-ok-line bg-ok-soft text-ok",
    neutral: "border-line bg-raised text-muted",
    avoid: "border-warn-line bg-warn-soft text-warn",
  };
  const icon: Record<Preference, string> = { preferred: "♥", neutral: "•", avoid: "✕" };

  return (
    <div
      role="group"
      aria-label={t.people.preference}
      className="flex items-center gap-0.5 rounded-[var(--r-sm)] border border-line p-0.5"
    >
      {PREFERENCES.map((option) => {
        const on = value === option;
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            title={t.people[`${option}Full` as const]}
            onClick={() => onChange(option)}
            className={`rounded-[3px] border px-1.5 py-0.5 text-2xs font-medium transition ${
              on ? tone[option] : "border-transparent text-faint hover:text-foreground"
            }`}
          >
            <span aria-hidden className="mr-1">
              {icon[option]}
            </span>
            {t.people[option]}
          </button>
        );
      })}
    </div>
  );
}
