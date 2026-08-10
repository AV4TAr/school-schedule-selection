import { PrintView } from "@/components/PrintView";
import {
  getAssignments,
  getAvailability,
  getPeople,
  getShifts,
} from "@/lib/db/queries";
import type { Weekday } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function PrintPage() {
  const shifts = getShifts();
  const weekdays = [...new Set(shifts.filter((s) => s.active).map((s) => s.weekday))].sort(
    (a, b) => a - b,
  ) as Weekday[];

  return (
    <PrintView
      people={getPeople()}
      shifts={shifts}
      availability={getAvailability()}
      assignments={getAssignments()}
      weekdays={weekdays}
    />
  );
}
