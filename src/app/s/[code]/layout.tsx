import { notFound } from "next/navigation";

import { ScheduleNav } from "@/components/ScheduleNav";
import { getScheduleByCode } from "@/lib/db/queries";
import { getUndoLabels } from "@/lib/db/undo";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Resolves the URL's code to a schedule for everything beneath it. An unknown
 * code is a 404 — the same response as a code that exists but was mistyped, so
 * the page gives away nothing about which codes are real.
 */
export default async function ScheduleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const schedule = getScheduleByCode(decodeURIComponent(code));
  if (!schedule) notFound();

  const admin = await isAdmin(schedule.id);

  return (
    <>
      <ScheduleNav
        scheduleId={schedule.id}
        code={schedule.code}
        scheduleName={schedule.name}
        isAdmin={admin}
        undoLabels={admin ? getUndoLabels(schedule.id) : []}
      />
      <main className="mx-auto max-w-6xl px-6 py-7">{children}</main>
    </>
  );
}
