"use client";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { fmt } from "@/lib/format";
import {
  entries,
  latestPackingList,
  produced,
  titles,
  type Database,
  type Lot,
} from "@/lib/store";

/** The Owner's next step on one shipment. The outbound transport document is Foodiva's,
 * so the Owner only waits on it; the Owner acts again at the smoke PO and the return trip. */
export function LotWorkflowAction({
  db,
  lot,
  open,
  onOpenSmokePo,
}: {
  db: Database;
  lot: Lot;
  open: (kind: string, lotId?: string) => void;
  /** Navigate to the smoking PO tab. */
  onOpenSmokePo: () => void;
}) {
  // Until Foodiva makes the manifest the Owner may still change the Request (A10).
  if (lot.stage === 1)
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Badge tone="danger">รอ Foodiva ทำใบขนส่ง</Badge>
        <Button
          variant="table"
          onClick={() => open("shipmentRequestEdit", lot.id)}
        >
          แก้ไข Request
        </Button>
      </span>
    );
  if (lot.stage < 6) {
    if (!latestPackingList(db, lot.id))
      return <Badge tone="danger">รอ Foodiva ทำ Packing List</Badge>;
    if (!entries(db, "smokeOrder", lot.id).length)
      return (
        <Button variant="table" onClick={onOpenSmokePo}>
          ไปออก PO รมควัน
        </Button>
      );
    if (!entries(db, "smokeOrderAccept", lot.id).length)
      return <Badge tone="danger">รอ Chef House รับ PO</Badge>;
    return <>กำลังดำเนินงานที่ Chef House</>;
  }
  if (lot.stage === 6)
    return (
      <Button variant="table" onClick={() => open("return", lot.id)}>
        {titles.return} · {fmt(produced(db, lot.id))} กก.
      </Button>
    );
  if (lot.stage === 7 && !entries(db, "foodivaReturnReceive", lot.id).length)
    return <>รอ Foodiva รับเข้าตู้</>;
  return <>Foodiva รับเข้าตู้แล้ว</>;
}
