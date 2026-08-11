import { notFound } from "next/navigation";

import { PrintView } from "@/components/PrintView";
import {
  getAssignments,
  getAvailability,
  getPeople,
  getScheduleByCode,
  getShifts,
} from "@/lib/db/queries";
import type { Weekday } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PrintPage({
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
    <PrintView
      code={schedule.code}
      people={getPeople(schedule.id)}
      shifts={shifts}
      availability={getAvailability(schedule.id)}
      assignments={getAssignments(schedule.id)}
      weekdays={weekdays}
    />
  );
}
