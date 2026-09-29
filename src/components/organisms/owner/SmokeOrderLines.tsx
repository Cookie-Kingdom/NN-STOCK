"use client";

import { Badge } from "@/components/atoms/Badge";
import { Input } from "@/components/atoms/Input";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { fmt } from "@/lib/format";
import { entries, poRemainingKg, type Database, type Lot } from "@/lib/store";

/** A smoke PO's `lines` (SMK-02): how many kg each purchase PO sends to this batch. Shared by
 *  the new smoke PO form and the Owner's edit of one (SMK-05); `own` is the kg this PO
 *  already draws per purchase PO, added back to what each has left. */
export function SmokeOrderLines({
  db,
  pos,
  kg,
  own = {},
  onLine,
}: {
  db: Database;
  pos: Lot[];
  kg: Record<string, string>;
  own?: Record<string, number>;
  onLine: (poId: string, value: string) => void;
}) {
  return (
    <DataTable
      title="PO ซื้อที่ใช้ในชุดนี้ (กก.)"
      columns={["เลข PO", "Invoice เนื้อ", "คงเหลือ", "ส่งชุดนี้ (กก.)"]}
      numericColumns={["ส่งชุดนี้ (กก.)"]}
      emptyText="ไม่มี PO ซื้อที่มีเนื้อคงเหลือ · ออก PO รมควันได้โดยไม่ระบุ PO ซื้อ แล้วผูกภายหลัง"
      rowKeys={pos.map((po) => po.id)}
      rows={pos.map((po) => {
        const invoice = entries(db, "foodivaConfirm", po.id).at(-1);
        return [
          <strong key="po">{po.poId}</strong>,
          invoice ? (
            invoice.values.invoiceNo || "มีแล้ว"
          ) : (
            <Badge key="invoice" tone="warning">
              ยังไม่มี Invoice
            </Badge>
          ),
          `${fmt(poRemainingKg(db, po.id) + (own[po.id] ?? 0))} กก.`,
          <Input
            key="kg"
            variant="table"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            aria-label={`น้ำหนักที่ส่งจาก ${po.poId}`}
            placeholder="0"
            value={kg[po.id] || ""}
            onChange={(event) => onLine(po.id, event.target.value)}
          />,
        ];
      })}
    />
  );
}
