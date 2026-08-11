import { MyScheduleView } from "@/components/MyScheduleView";
import { getAssignments, getPeople, getShifts } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default function MySchedulePage() {
  return (
    <MyScheduleView
      people={getPeople().filter((p) => p.active)}
      shifts={getShifts().filter((s) => s.active)}
      assignments={getAssignments()}
    />
  );
}
