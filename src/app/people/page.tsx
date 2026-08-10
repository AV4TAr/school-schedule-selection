import { PeopleEditor } from "@/components/PeopleEditor";
import { getAvailability, getPeople } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default function PeoplePage() {
  return <PeopleEditor people={getPeople()} availability={getAvailability()} />;
}
