import { notFound } from "next/navigation";

import { ScheduleView } from "@/components/ScheduleView";
import {
  getAssignments,
  getAvailability,
  getPeople,
  getScheduleByCode,
  getShifts,
  getSolverSettings,
} from "@/lib/db/queries";
import { isAdmin } from "@/lib/session";
import type { Weekday } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const schedule = getScheduleByCode(decodeURIComponent(code));
  if (!schedule) notFound();

  const shifts = getShifts(schedule.id);
  const weekdays = [...new Set(shifts.filter((s) => s.active).map((s) => s.weekday))].sort(
    (a, b) => a - b,
  ) as Weekday[];

  return (
    <ScheduleView
      scheduleId={schedule.id}
      canEdit={await isAdmin(schedule.id)}
      people={getPeople(schedule.id)}
      shifts={shifts}
      availability={getAvailability(schedule.id)}
      assignments={getAssignments(schedule.id)}
      weekdays={weekdays}
      settings={getSolverSettings(schedule.id)}
      code={schedule.code}
    />
  );
}
