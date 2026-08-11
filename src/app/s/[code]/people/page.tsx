import { notFound, redirect } from "next/navigation";

import { PeopleEditor } from "@/components/PeopleEditor";
import { getAvailability, getPeople, getScheduleByCode } from "@/lib/db/queries";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const schedule = getScheduleByCode(decodeURIComponent(code));
  if (!schedule) notFound();
  // Editing pages are admin-only end to end; a view-only visitor is sent to
  // sign in rather than shown a read-only version of an editor.
  if (!(await isAdmin(schedule.id))) redirect(`/s/${schedule.code}/login`);

  return (
    <PeopleEditor
      scheduleId={schedule.id}
      people={getPeople(schedule.id)}
      availability={getAvailability(schedule.id)}
    />
  );
}
