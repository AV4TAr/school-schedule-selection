import { notFound } from "next/navigation";

import { MyScheduleView } from "@/components/MyScheduleView";
import { getAssignments, getPeople, getScheduleByCode, getShifts } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function MySchedulePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const schedule = getScheduleByCode(decodeURIComponent(code));
  if (!schedule) notFound();

  return (
    <MyScheduleView
      code={schedule.code}
      scheduleName={schedule.name}
      people={getPeople(schedule.id).filter((p) => p.active)}
      shifts={getShifts(schedule.id).filter((s) => s.active)}
      assignments={getAssignments(schedule.id)}
    />
  );
}
