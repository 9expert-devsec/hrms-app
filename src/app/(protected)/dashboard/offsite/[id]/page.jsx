import { Suspense } from "react";
import { requirePage } from "@/lib/rbac/guard";
import OffsiteDetail from "../../../../../components/offsite/OffsiteDetail";

export const metadata = { title: "คำขอทำงานนอกสถานที่" };

export default async function OffsiteRequestPage({ params }) {
  await requirePage("offsite_self");
  const { id } = await params;
  return (
    <div className="container mx-auto max-w-5xl px-6 py-6">
      <Suspense>
        <OffsiteDetail id={id} />
      </Suspense>
    </div>
  );
}
