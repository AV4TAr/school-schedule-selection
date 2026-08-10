import { ShiftsEditor } from "@/components/ShiftsEditor";
import { getShifts } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default function ShiftsPage() {
  return <ShiftsEditor shifts={getShifts()} />;
}
