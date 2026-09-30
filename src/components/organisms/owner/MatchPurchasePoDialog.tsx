"use client";

import { useState } from "react";
import { Notice } from "@/components/molecules/Notice";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { EditEntryForm } from "@/components/organisms/shared/EntryDetails";
import { today } from "@/lib/format";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
import { check, entries, mutate, type Database } from "@/lib/store";

/** RET-07: the Owner names the purchase POs a smoke batch drew from, so the meat that goes
 *  on to the branches traces back to them. It is the smoke PO's own edit (SMK-05), opened
 *  from central receive with the reason filled in; saved as an `entryEdit` like any edit. */
export function MatchPurchasePoDialog({
  db,
  lotId,
  onClose,
  onSaved,
}: {
  db: Database;
  lotId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [error, setError] = useState("");
  const lot = db.lots.find((item) => item.id === lotId);
  const order = entries(db, "smokeOrder", lotId).at(-1);
  return (
    <Dialog
      overline={lot ? `${lot.poId} · ${lot.id}` : undefined}
      title="จับคู่ PO ซื้อ"
      onClose={onClose}
    >
      <DialogBody>
        <Notice>
          ระบุ PO ซื้อและน้ำหนักที่ชุดรมควันนี้ใช้ ·
          ใช้ย้อนดูที่มาของเนื้อที่ส่งสาขาและคิดต้นทุนเนื้อ
        </Notice>
        {order ? (
          <EditEntryForm
            entry={order}
            db={db}
            request={false}
            error={error}
            initialReason="จับคู่ PO ซื้อที่หน้ารับเข้าสต๊อกกลาง"
            onCancel={onClose}
            onSubmit={(values, reason) => {
              setError("");
              let next = undefined as Database | undefined;
              const { warnings, error } = check(() => {
                next = mutate(
                  latestDatabase(),
                  "owner",
                  "entryEdit",
                  {
                    targetId: order.id,
                    values: JSON.stringify(values),
                    reason,
                  },
                  "",
                  today(),
                );
              });
              if (!next) return setError(error || "บันทึกการจับคู่ไม่สำเร็จ");
              saveDatabase(next);
              onSaved(["จับคู่ PO ซื้อแล้ว", ...warnings].join(" · "));
            }}
          />
        ) : (
          <Notice tone="warning" className="mt-3">
            ชุดนี้ยังไม่มี PO รมควัน · ออก PO รมควันพร้อมระบุ PO
            ซื้อได้ที่ใบสั่ง PO โรงรมควัน
          </Notice>
        )}
      </DialogBody>
    </Dialog>
  );
}
