import { notFound, redirect } from "next/navigation";

import { SettingsForm } from "@/components/SettingsForm";
import { getScheduleByCode, getSolverSettings } from "@/lib/db/queries";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const schedule = getScheduleByCode(decodeURIComponent(code));
  if (!schedule) notFound();
  if (!(await isAdmin(schedule.id))) redirect(`/s/${schedule.code}/login`);

  return (
    <SettingsForm
      scheduleId={schedule.id}
      code={schedule.code}
      scheduleName={schedule.name}
      initial={getSolverSettings(schedule.id)}
    />
  );
}
