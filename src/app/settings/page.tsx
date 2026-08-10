import { SettingsForm } from "@/components/SettingsForm";
import { getSolverSettings } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <SettingsForm initial={getSolverSettings()} />;
}
