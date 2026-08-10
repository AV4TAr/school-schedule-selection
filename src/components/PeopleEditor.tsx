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
import { SCHOOL_WEEKDAYS, type AvailabilityWindow, type Person, type Weekday } from "@/lib/types";

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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t.people.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.people.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="field w-52"
            placeholder={t.people.newPerson}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNew()}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || !newName.trim()}
            onClick={submitNew}
          >
            {t.people.addPerson}
          </button>
        </div>
      </header>

      <p className="text-xs text-muted">{t.people.windowHint}</p>

      {people.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">{t.people.emptyState}</p>
      ) : (
        <div className="space-y-4">
          {people.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              windows={availability.filter((w) => w.personId === person.id)}
              pending={pending}
              run={startTransition}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonCard({
  person,
  windows,
  pending,
  run,
}: {
  person: Person;
  windows: AvailabilityWindow[];
  pending: boolean;
  run: (fn: () => void) => void;
}) {
  const { t, weekday } = useI18n();
  const [name, setName] = useState(person.name);

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === person.name) {
      setName(person.name);
      return;
    }
    run(() => void updatePerson(person.id, { name: trimmed }));
  };

  return (
    <section className="card">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <input
          className="field w-56 font-medium"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />

        <label className="flex items-center gap-2 text-sm text-muted">
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

        <button
          type="button"
          className="btn btn-ghost ml-auto"
          disabled={pending}
          onClick={() => {
            if (confirm(t.common.confirmDelete)) run(() => void deletePerson(person.id));
          }}
        >
          {t.people.deletePerson}
        </button>
      </div>

      <div className="space-y-2 px-4 py-3">
        <h3 className="label">{t.people.availability}</h3>

        {windows.length === 0 ? (
          <p className="py-1 text-sm text-warn">{t.people.noWindows}</p>
        ) : (
          <ul className="space-y-2">
            {windows.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-2">
                <select
                  className="field w-36"
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
                <span className="text-muted">→</span>
                <TimeField
                  value={w.endMin}
                  disabled={pending}
                  onCommit={(endMin) => run(() => void updateAvailability(w.id, { endMin }))}
                />

                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={pending}
                  onClick={() => run(() => void deleteAvailability(w.id))}
                >
                  {t.common.delete}
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className="btn mt-1"
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

  return (
    <input
      type="time"
      className="field w-28 tabular-nums"
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const parsed = parseTime(draft);
        if (parsed === null) {
          setDraft(toTimeInput(value));
          return;
        }
        if (parsed !== value) onCommit(parsed);
      }}
    />
  );
}
