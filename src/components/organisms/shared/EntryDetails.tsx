"use client";

import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { ReadRow } from "@/components/atoms/ReadRow";
import { forms } from "@/lib/forms";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
import { mutate, roleName, titles, type Entry } from "@/lib/store";
import { today } from "@/lib/format";

const reversibleKinds = [
  "allocate",
  "chiliAllocate",
  "receive",
  "thaw",
  "ricePurchase",
  "chiliPurchase",
  "riceIssue",
  "chiliIssue",
  "rice",
  "riceCarry",
  "sale",
  "materials",
  "materialReceive",
  "generalPurchase",
  "materialTransfer",
  "materialConfirm",
  "closeDay",
  "expense",
  "unlock",
];

/** Labels for computed values that are not fields of the entry's form. */
const derivedLabels: Record<string, string> = {
  postSmokeKg: "น้ำหนักผลิตรวม",
  packCount: "จำนวนถุงใหญ่",
  outboundCost: "ค่ารถขาไป",
  returnCost: "ค่ารถขากลับ",
  revenue: "ยอดขายบันทึก",
  menuTotal: "ยอดตามเมนู",
  chiliAddons: "น้ำพริกที่ขายแยก",
  chiliComplimentary: "น้ำพริกแถม (ยกเลิกแล้ว)",
  riceServings: "ข้าวเหนียวในกล่อง",
  chiliSold: "น้ำพริกที่ตัดสต๊อกรวม",
  allocation: "ใบจัดสรร",
  batches: "Log สโมคที่แก้ไข",
  meatCost: "ต้นทุนเนื้อขาย",
  wasteCost: "ต้นทุนเนื้อ Waste",
};

export function EntryDetails({
  entry: e,
  owner,
  onChanged,
}: {
  entry: Entry;
  owner: boolean;
  onChanged: (message: string) => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const reversible = reversibleKinds.includes(e.kind);
  const cancelEntry = () => {
    try {
      const next = mutate(
        latestDatabase(),
        "owner",
        "void",
        { targetId: e.id, reason },
        "",
        today(),
      );
      saveDatabase(next);
      onChanged("ยกเลิกรายการแล้ว ระบบคำนวณยอดใหม่และเก็บเหตุผลไว้ในประวัติ");
    } catch (error) {
      onChanged(
        error instanceof Error ? error.message : "ยกเลิกรายการไม่สำเร็จ",
      );
    }
  };
  return (
    <details className="border-b border-border py-3.5">
      <summary>
        <span>
          {titles[e.kind] || e.kind}{" "}
          <small>
            {e.date} · {e.lotId || e.branch} · {roleName[e.role]}
          </small>
        </span>
        <span>ดูรายละเอียด</span>
      </summary>
      {Object.entries(e.values)
        .filter(([, v]) => v !== "")
        .map(([k, v]) => (
          <ReadRow
            key={k}
            label={
              forms[e.kind]?.find((f) => f.key === k)?.label ||
              derivedLabels[k] ||
              k
            }
            value={v}
          />
        ))}
      <small className="text-text-secondary">
        บันทึก {new Date(e.at).toLocaleString("th-TH")}
      </small>
      {owner && reversible && (
        <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-border pt-3.5">
          {cancelling ? (
            <>
              <Input
                variant="table"
                reason
                className="flex-1"
                value={reason}
                placeholder="เหตุผลที่ยกเลิกรายการ"
                aria-label="เหตุผลที่ยกเลิกรายการ"
                onChange={(event) => setReason(event.target.value)}
              />
              <Button onClick={() => setCancelling(false)}>กลับ</Button>
              <Button variant="danger" onClick={cancelEntry}>
                ยืนยันยกเลิก
              </Button>
            </>
          ) : (
            <Button onClick={() => setCancelling(true)}>
              แก้รายการผิดด้วยการยกเลิก
            </Button>
          )}
        </div>
      )}
    </details>
  );
}
