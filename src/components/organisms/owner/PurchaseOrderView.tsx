"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { LotWorkflowAction } from "@/components/organisms/owner/LotWorkflowAction";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import {
  lotIssueDate,
  purchaseOrderRows,
} from "@/components/organisms/shared/documents";
import { fmt } from "@/lib/format";
import { entries, n, stages, type Database } from "@/lib/store";

const columns = [
  "เลข PO",
  "Lot",
  "วันที่ออก PO",
  "ลูกค้า / Attention",
  "สินค้า / ขนาดบรรจุ",
  "น้ำหนักสั่งซื้อ",
  "Invoice Foodiva",
  "สถานะ",
  "การทำงาน",
];

export function PurchaseOrderView({
  db,
  open,
  onOpenSmokePo,
}: {
  db: Database;
  open: (kind: string, lotId?: string) => void;
  onOpenSmokePo: () => void;
}) {
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
        rowKeys={db.lots.map((item) => item.id)}
        rows={db.lots.map((item) => {
          const print = (
            <DocumentPrintButton
              title="Purchase Order"
              number={item.poId}
              rows={purchaseOrderRows(item, db)}
            />
          );
          return [
            item.poId,
            item.id,
            lotIssueDate(db, item),
            `${item.values.customerName || "-"} / ${item.values.attention || "-"}`,
            `${item.values.productName || "เนื้อวัว"} / ${item.values.packSize || "-"}`,
            `${fmt(n(item.values, "orderedKg"))} กก.`,
            entries(db, "foodivaConfirm", item.id).at(-1)?.values.invoiceNo ||
              "รอยืนยัน",
            stages[item.stage],
            item.stage === 1 ? (
              <ButtonRow key={item.id}>
                <LotWorkflowAction
                  db={db}
                  lot={item}
                  context="purchase-order"
                  open={open}
                  onOpenSmokePo={onOpenSmokePo}
                />
                {print}
              </ButtonRow>
            ) : (
              print
            ),
          ];
        })}
      />
    </>
  );
}
