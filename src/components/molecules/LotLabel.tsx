import { Badge } from "@/components/atoms/Badge";
import { noLotLabel } from "@/lib/nav";

/** A branch meat row's lot: the batch id, or for the "ไม่ระบุ Lot" bucket (`lotId ""`,
 *  BR-04) that name plus a "ยังไม่ผูก Lot" badge, so a row nobody has tied to a smoke
 *  batch yet stands out in every summary. */
export function LotLabel({ lotId }: { lotId: string }) {
  if (lotId) return <>{lotId}</>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {noLotLabel}
      <Badge tone="warning">ยังไม่ผูก Lot</Badge>
    </span>
  );
}
