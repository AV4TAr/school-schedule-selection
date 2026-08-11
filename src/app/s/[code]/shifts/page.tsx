import { notFound, redirect } from "next/navigation";

import { ShiftsEditor } from "@/components/ShiftsEditor";
import { getScheduleByCode, getShifts } from "@/lib/db/queries";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ShiftsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const schedule = getScheduleByCode(decodeURIComponent(code));
  if (!schedule) notFound();
  if (!(await isAdmin(schedule.id))) redirect(`/s/${schedule.code}/login`);

  return <ShiftsEditor scheduleId={schedule.id} shifts={getShifts(schedule.id)} />;
}
