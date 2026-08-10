import { ScheduleView } from "@/components/ScheduleView";
import {
  getAssignments,
  getAvailability,
  getPeople,
  getShifts,
  getSolverSettings,
} from "@/lib/db/queries";
import type { Weekday } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function SchedulePage() {
  const shifts = getShifts();
  const weekdays = [...new Set(shifts.filter((s) => s.active).map((s) => s.weekday))].sort(
    (a, b) => a - b,
  ) as Weekday[];

  return (
    <ScheduleView
      people={getPeople()}
      shifts={shifts}
      availability={getAvailability()}
      assignments={getAssignments()}
      weekdays={weekdays}
      settings={getSolverSettings()}
    />
  );
}
