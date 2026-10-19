import { Suspense } from "react";
import { requirePage } from "@/lib/rbac/guard";
import OffsiteList from "../../../../components/offsite/OffsiteList";

export const metadata = { title: "ทำงานนอกสถานที่" };

export default async function OffsitePage() {
  await requirePage("offsite_self");
  return (
    <div className="container mx-auto px-6 py-6">
      <Suspense>
        <OffsiteList />
      </Suspense>
    </div>
  );
}
