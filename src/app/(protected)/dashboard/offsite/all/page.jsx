import { requirePage } from "@/lib/rbac/guard";
import OffsiteAllList from "../../../../../components/offsite/OffsiteAllList";

export const metadata = { title: "คำขอทำงานนอกสถานที่ทั้งหมด" };

export default async function OffsiteAllPage() {
  await requirePage("offsite_hr");
  return (
    <div className="container mx-auto px-6 py-6">
      <OffsiteAllList />
    </div>
  );
}
