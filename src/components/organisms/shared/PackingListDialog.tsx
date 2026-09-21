"use client";

import { Notice } from "@/components/molecules/Notice";
import {
  packingListView,
  receivedDraft,
} from "@/components/organisms/chef/receivedBoxes";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { AttachmentViewButton } from "@/components/organisms/shared/InvoiceDownloadButton";
import { PackingListTable } from "@/components/organisms/shared/PackingListTable";
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

/** Read-only Packing List of one shipment, with Chef House's yellow cells once weighed in.
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
  const view =
    list &&
    packingListView(list, receivedDraft(list, lot?.values.receivedBoxes));
  return (
    <Dialog
      size="wide"
      overline={`อ่านอย่างเดียว · ${lot?.poId ?? ""}`}
      title="Packing List"
      onClose={onClose}
      footer={<DialogFooter cancelLabel="ปิด" onCancel={onClose} />}
    >
      <DialogBody>
        {showPurchaseOrders && lot && <PurchaseOrderList db={db} lot={lot} />}
        {view ? (
          <>
            {list.values.attachmentStorageKey && (
              <AttachmentViewButton
                name={list.values.attachment}
                storageKey={list.values.attachmentStorageKey}
                label={`ไฟล์ที่ Foodiva แนบ · ${list.values.attachment}`}
              />
            )}
            <PackingListTable header={view.header} boxes={view.boxes} />
          </>
        ) : (
          <Notice>ยังไม่มี Packing List ของการส่งนี้</Notice>
        )}
      </DialogBody>
    </Dialog>
  );
}
