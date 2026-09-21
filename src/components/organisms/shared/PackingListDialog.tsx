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
import { latestPackingList, type Database } from "@/lib/store";

/** Read-only Packing List of one shipment, with Chef House's yellow cells once weighed in. */
export function PackingListDialog({
  db,
  lotId,
  onClose,
}: {
  db: Database;
  lotId: string;
  onClose: () => void;
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
        {view ? (
          <>
            {list.values.attachmentStorageKey && (
              <AttachmentViewButton
                name={list.values.attachment}
                storageKey={list.values.attachmentStorageKey}
                label={`ไฟล์ที่ Foodiva แนบ · ${list.values.attachment}`}
              />
            )}
            <PackingListTable
              header={{
                ...view.header,
                invoiceNo: list.values.invoiceNo ?? "",
              }}
              boxes={view.boxes}
            />
          </>
        ) : (
          <Notice>ยังไม่มี Packing List ของการส่งนี้</Notice>
        )}
      </DialogBody>
    </Dialog>
  );
}
