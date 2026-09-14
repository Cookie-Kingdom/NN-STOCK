"use client";

import { Notice } from "@/components/molecules/Notice";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { PurchaseOrderDocumentPreview } from "@/components/organisms/shared/PurchaseOrderDocumentPreview";
import { entries, type Database } from "@/lib/store";

export function SmokeOrderPreviewDialog({
  db,
  lotId,
  onClose,
}: {
  db: Database;
  lotId: string;
  onClose: () => void;
}) {
  const lot = db.lots.find((item) => item.id === lotId);
  const order = entries(db, "smokeOrder", lotId).at(-1);
  return (
    <Dialog
      size="document"
      overline="อ่านอย่างเดียว · Chef_house"
      title="ใบสั่ง PO โรงรมควัน"
      closeLabel="ปิดเอกสาร PO"
      onClose={onClose}
      footer={
        <DialogFooter
          hint="ตรวจคำสั่งและยอดก่อนกดยืนยันรับ PO"
          cancelLabel="ปิด"
          onCancel={onClose}
        />
      }
    >
      {lot && order ? (
        <PurchaseOrderDocumentPreview
          db={db}
          lot={lot}
          kind="smokeOrder"
          values={order.values}
          date={order.date}
        />
      ) : (
        <DialogBody>
          <Notice tone="warning">ไม่พบเอกสาร PO รายการนี้</Notice>
        </DialogBody>
      )}
    </Dialog>
  );
}
