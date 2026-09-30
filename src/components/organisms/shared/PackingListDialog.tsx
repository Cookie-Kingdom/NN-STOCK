"use client";

import { Notice } from "@/components/molecules/Notice";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { PackingListSummary } from "@/components/organisms/shared/PackingListSummary";
import { fmt } from "@/lib/format";
import {
  entries,
  latestPackingList,
  shipmentLines,
  type Database,
  type Lot,
} from "@/lib/store";

/** A1 — the purchase POs the shipment (and so its Packing List) draws on: PO number,
 *  Foodiva invoice and the kg asked of each. Boxes are not tied to a PO. Owner only:
 *  Chef House must never see purchase PO numbers. */
function PurchaseOrderList({ db, lot }: { db: Database; lot: Lot }) {
  const lines = shipmentLines(lot);
  if (!lines.length) return null;
  return (
    <section className="grid gap-1.5 rounded-lg border border-border bg-bg px-4 py-3 text-body-sm">
      <strong>PO ซื้อในการส่งนี้</strong>
      <ul className="m-0 grid list-none gap-1 p-0 tabular-nums">
        {lines.map((line) => {
          const po = db.lots.find((l) => l.id === line.lotId);
          const invoiceNo = entries(db, "foodivaConfirm", line.lotId).at(-1)
            ?.values.invoiceNo;
          return (
            <li key={line.lotId}>
              {`${po?.poId ?? line.lotId} · Invoice Foodiva ${invoiceNo || "—"} · ${fmt(line.kg)} กก.`}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Read-only Packing List of one shipment: Foodiva's file and totals, with Chef House's
 *  received total once weighed in.
 *  `showPurchaseOrders` (Owner only) lists the purchase POs the shipment covers. */
export function PackingListDialog({
  db,
  lotId,
  onClose,
  showPurchaseOrders = false,
}: {
  db: Database;
  lotId: string;
  onClose: () => void;
  showPurchaseOrders?: boolean;
}) {
  const lot = db.lots.find((l) => l.id === lotId);
  const list = latestPackingList(db, lotId);
  const weighed = entries(db, "cmReceive", lotId).length > 0;
  return (
    <Dialog
      overline={`อ่านอย่างเดียว · ${lot?.poId ?? ""}`}
      title="Packing List"
      onClose={onClose}
      footer={<DialogFooter cancelLabel="ปิด" onCancel={onClose} />}
    >
      <DialogBody>
        {showPurchaseOrders && lot && <PurchaseOrderList db={db} lot={lot} />}
        {list ? (
          <PackingListSummary
            values={list.values}
            receivedKg={weighed ? (lot?.values.receivedKg ?? "") : undefined}
          />
        ) : (
          <Notice>ยังไม่มี Packing List ของการส่งนี้</Notice>
        )}
      </DialogBody>
    </Dialog>
  );
}
