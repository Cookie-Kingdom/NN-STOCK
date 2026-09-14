"use client";

import { X } from "lucide-react";
import { PurchaseOrderDocumentPreview } from "@/components/shared/PurchaseOrderDocumentPreview";
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
    <div className="modal-backdrop" onKeyDown={(event) => event.key === "Escape" && onClose()}>
      <section className="form-dialog po-document-dialog" role="dialog" aria-modal="true" aria-labelledby="smoke-po-preview-title">
        <header>
          <div>
            <span className="overline">อ่านอย่างเดียว · Chef_house</span>
            <h2 id="smoke-po-preview-title">ใบสั่ง PO โรงรมควัน</h2>
          </div>
          <button type="button" className="icon-button" aria-label="ปิดเอกสาร PO" onClick={onClose}><X /></button>
        </header>
        {lot && order ? (
          <PurchaseOrderDocumentPreview
            db={db}
            lot={lot}
            kind="smokeOrder"
            values={order.values}
            date={order.date}
          />
        ) : (
          <div className="form-body"><div className="notice warning">ไม่พบเอกสาร PO รายการนี้</div></div>
        )}
        <footer>
          <p>ตรวจคำสั่งและยอดก่อนกดยืนยันรับ PO</p>
          <button type="button" className="secondary" onClick={onClose}>ปิด</button>
        </footer>
      </section>
    </div>
  );
}
