"use client";

import { useState } from "react";
import { Read } from "@/components/shared/primitives";
import { forms } from "@/lib/forms";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
import {    mutate, roleName, titles, type Entry } from "@/lib/store";
import { today } from "@/lib/format";

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
  const reversible = [
    "allocate", "chiliAllocate", "receive", "thaw", "ricePurchase", "chiliPurchase",
    "riceIssue", "chiliIssue", "rice", "riceCarry", "sale", "materials",
    "materialReceive", "generalPurchase", "materialTransfer", "materialConfirm", "closeDay",
    "expense", "unlock",
  ].includes(e.kind);
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
      onChanged(error instanceof Error ? error.message : "ยกเลิกรายการไม่สำเร็จ");
    }
  };
  return (
    <details className="entry">
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
          <Read
            key={k}
            label={
              forms[e.kind]?.find((f) => f.key === k)?.label ||
              (
                {
                  outputKg: "น้ำหนักผลิตรวม",
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
                  meatCost: "ต้นทุนเนื้อขาย",
                  wasteCost: "ต้นทุนเนื้อ Waste",
                } as Record<string, string>
              )[k] ||
              k
            }
            value={v}
          />
        ))}
      <small className="muted">
        บันทึก {new Date(e.at).toLocaleString("th-TH")}
      </small>
      {owner && reversible && (
        <div className="entry-correction">
          {cancelling ? (
            <>
              <input
                className="table-edit-control reason-control"
                value={reason}
                placeholder="เหตุผลที่ยกเลิกรายการ"
                onChange={(event) => setReason(event.target.value)}
              />
              <button className="secondary" onClick={() => setCancelling(false)}>
                กลับ
              </button>
              <button className="danger-button" onClick={cancelEntry}>
                ยืนยันยกเลิก
              </button>
            </>
          ) : (
            <button className="secondary" onClick={() => setCancelling(true)}>
              แก้รายการผิดด้วยการยกเลิก
            </button>
          )}
        </div>
      )}
    </details>
  );
}
