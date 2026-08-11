import { notFound, redirect } from "next/navigation";

import { LoginForm } from "@/components/LoginForm";
import { getScheduleByCode } from "@/lib/db/queries";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const schedule = getScheduleByCode(decodeURIComponent(code));
  if (!schedule) notFound();
  if (await isAdmin(schedule.id)) redirect(`/s/${schedule.code}`);

  return (
    <LoginForm
      code={schedule.code}
      scheduleName={schedule.name}
      // A schedule with no password yet lets the first visitor claim it, so the
      // form explains that rather than asking for a password that doesn't exist.
      needsFirstPassword={!schedule.hasPassword}
    />
  );
}
