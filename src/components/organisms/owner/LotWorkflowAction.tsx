"use client";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { fmt } from "@/lib/format";
import {
  entries,
  produced,
  smokingInvoiceStatus,
  titles,
  type Database,
  type Lot,
} from "@/lib/store";

/**
 * Where the chain is shown. The two call sites differ on purpose:
 * - `purchase-order` (PO tab, stage 1 only): links to the smoking PO tab when the
 *   smoke PO is missing, and falls through to dispatch unless the invoice was sent back.
 * - `transport`: badges instead of the smoking PO link, waits for any unpaid invoice
 *   status, and continues with the return-trip stages.
 */
export type LotWorkflowContext = "purchase-order" | "transport";

const labels: Record<
  LotWorkflowContext,
  { smokeOrder: string; smokingInvoice: string }
> = {
  "purchase-order": {
    smokeOrder: "ไปใบสั่ง PO โรงรมควัน",
    smokingInvoice: "รอ Chef House Submit ใบวางบิล",
  },
  transport: {
    smokeOrder: "รอ Owner ออก PO รมควัน",
    smokingInvoice: "รอ Chef House Submit Invoice",
  },
};

export function LotWorkflowAction({
  db,
  lot,
  context,
  open,
  onOpenSmokePo,
}: {
  db: Database;
  lot: Lot;
  context: LotWorkflowContext;
  open: (kind: string, lotId?: string) => void;
  /** `purchase-order` only: navigate to the smoking PO tab. */
  onOpenSmokePo?: () => void;
}) {
  const text = labels[context];
  if (lot.stage === 1) {
    if (!entries(db, "foodivaConfirm", lot.id).length)
      return <Badge tone="danger">รอ Foodiva ออก Invoice</Badge>;
    if (!entries(db, "smokeOrder", lot.id).length)
      return context === "purchase-order" ? (
        <Button variant="table" onClick={onOpenSmokePo}>
          {text.smokeOrder}
        </Button>
      ) : (
        <Badge tone="danger">{text.smokeOrder}</Badge>
      );
    if (!entries(db, "smokeOrderAccept", lot.id).length)
      return <Badge tone="danger">รอ Chef House รับ PO</Badge>;
    const invoice = entries(db, "smokingInvoice", lot.id).at(-1);
    if (!invoice) return <Badge tone="danger">{text.smokingInvoice}</Badge>;
    const invoiceStatus = smokingInvoiceStatus(db, invoice);
    if (invoiceStatus === "รอตรวจยอด")
      return (
        <Button variant="table" onClick={() => open("invoiceReview", lot.id)}>
          ตรวจ Invoice เพื่อเรียกรถ
        </Button>
      );
    if (invoiceStatus === "รอชำระ")
      return (
        <Button variant="table" onClick={() => open("invoicePayment", lot.id)}>
          ชำระ Invoice เพื่อเรียกรถ
        </Button>
      );
    const waitingForFix =
      context === "purchase-order"
        ? invoiceStatus === "ส่งกลับแก้ไข"
        : invoiceStatus !== "ชำระแล้ว";
    if (waitingForFix)
      return <Badge tone="danger">รอ Chef House แก้ Invoice</Badge>;
    return (
      <Button variant="table" onClick={() => open("dispatch", lot.id)}>
        {titles.dispatch}
      </Button>
    );
  }
  if (context === "purchase-order") return null;
  if (lot.stage === 6)
    return (
      <Button variant="table" onClick={() => open("return", lot.id)}>
        {titles.return} · {fmt(produced(db, lot.id))} กก.
      </Button>
    );
  if (lot.stage < 6) return <>กำลังดำเนินงานที่ Chef House</>;
  if (lot.stage === 7 && !entries(db, "foodivaReturnReceive", lot.id).length)
    return <>รอ Foodiva รับเข้าตู้</>;
  return <>Foodiva รับเข้าตู้แล้ว</>;
}
