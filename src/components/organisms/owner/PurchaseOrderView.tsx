"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import {
  lotIssueDate,
  purchaseOrderRows,
} from "@/components/organisms/shared/documents";
import { fmt } from "@/lib/format";
import {
  entries,
  n,
  ownerWasteOutstanding,
  poRemainingKg,
  purchaseLots,
  type Database,
} from "@/lib/store";

const columns = [
  "เลข PO",
  "Lot",
  "วันที่ออก PO",
  "ลูกค้า / Attention",
  "สินค้า / ขนาดบรรจุ",
  "น้ำหนักสั่งซื้อ",
  "Invoice Foodiva",
  "คงเหลือส่ง Chef House",
  "เก็บไว้ให้ Owner คงเหลือ",
  "การทำงาน",
];

export function PurchaseOrderView({
  db,
  open,
}: {
  db: Database;
  open: (kind: string, lotId?: string) => void;
}) {
  const lots = purchaseLots(db);
  return (
    <>
      <SectionHeading
        title="ใบสั่งซื้อเนื้อ (Purchase orders)"
        description="สร้าง PO ใหม่และดูรายการที่เคยสร้าง"
        actions={
          <ButtonRow>
            <Button
              variant="primary"
              icon={<Plus />}
              onClick={() => open("purchase", "")}
            >
              สร้าง PO เนื้อ
            </Button>
          </ButtonRow>
        }
      />
      <DataTable
        title="รายการใบสั่งซื้อ PO"
        defaultSort={{ column: "วันที่ออก PO", desc: true }}
        columns={columns}
        rowKeys={lots.map((item) => item.id)}
        rows={lots.map((item) => {
          const confirm = entries(db, "foodivaConfirm", item.id).at(-1);
          return [
            item.poId,
            item.id,
            lotIssueDate(db, item),
            `${item.values.customerName || "-"} / ${item.values.attention || "-"}`,
            `${item.values.productName || "เนื้อวัว"} / ${item.values.packSize || "-"}`,
            `${fmt(n(item.values, "orderedKg"))} กก.`,
            confirm?.values.invoiceNo || "รอยืนยัน",
            confirm ? `${fmt(poRemainingKg(db, item.id))} กก.` : "—",
            // A8: of what Foodiva keeps for the Owner, what the Owner has not taken yet.
            confirm ? `${fmt(ownerWasteOutstanding(db, item.id))} กก.` : "—",
            <DocumentPrintButton
              key="print"
              title="Purchase Order"
              number={item.poId}
              rows={purchaseOrderRows(item, db)}
            />,
          ];
        })}
      />
    </>
  );
}
