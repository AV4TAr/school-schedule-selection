"use client";

import { useState, useTransition } from "react";

import { createPerson } from "@/app/actions";
import { PersonCard } from "@/components/people/PersonCard";
import { useI18n } from "@/lib/i18n/context";
import { type AvailabilityWindow, type Person } from "@/lib/types";

// Re-exported because `ShiftsEditor` edits times too and has always taken this
// from here; the component itself now lives with the rest of the people UI.
export { TimeField } from "@/components/people/TimeField";

interface Props {
  scheduleId: number;
  people: Person[];
  availability: AvailabilityWindow[];
}

export function PeopleEditor({ scheduleId, people, availability }: Props) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");

  const submitNew = () => {
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    startTransition(() => void createPerson(scheduleId, name));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start md:justify-between md:gap-4">
        <div>
          <h1 className="page-title">{t.people.title}</h1>
          <p className="mt-1 text-base text-muted">{t.people.subtitle}</p>
        </div>
        {/* Stacked and full width on a phone, where a 12rem input beside a
            button leaves neither enough room to be tapped comfortably. */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            className="field md:w-48"
            placeholder={t.people.newPerson}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitNew()}
          />
          <button
            type="button"
            className="btn btn-primary w-full md:w-auto"
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
              scheduleId={scheduleId}
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
