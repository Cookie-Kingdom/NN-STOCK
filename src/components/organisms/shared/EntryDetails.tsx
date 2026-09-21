"use client";

import { useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { ReadRow } from "@/components/atoms/ReadRow";
import { FormError } from "@/components/molecules/FormError";
import { SlipList } from "@/components/organisms/shared/InvoiceDownloadButton";
import { forms } from "@/lib/forms";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
import {
  mutate,
  roleName,
  titles,
  type Database,
  type Entry,
} from "@/lib/store";
import { fmt, today } from "@/lib/format";

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
  "influencerBox",
  "materials",
  "materialReceive",
  "generalPurchase",
  "materialTransfer",
  "materialConfirm",
  "closeDay",
  "expense",
  "unlock",
  "shipmentRequest",
];

/** Labels for computed values that are not fields of the entry's form. */
const derivedLabels: Record<string, string> = {
  postSmokeKg: "น้ำหนักผลิตรวม",
  packCount: "จำนวนกล่องรมควัน",
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
  meatCost: "ต้นทุนเนื้อที่ตัดสต๊อก",
  wasteCost: "ต้นทุนเนื้อ Waste",
  revision: "บันทึกครั้งที่",
  correctionReason: "เหตุผลที่แก้ไข",
  lines: "PO ที่ขอส่ง",
  requestedKg: "น้ำหนักที่ขอส่งรวม (กก.)",
};

/** A Request's `lines` JSON as one "PO-2026-0001 × 300.00 กก." per line. */
function requestLines(value: string, db?: Database) {
  try {
    const lines: { lotId?: string; kg?: string }[] = JSON.parse(value);
    return lines
      .map((line) => {
        const po = db?.lots.find((l) => l.id === line.lotId)?.poId;
        return `${po || line.lotId} × ${fmt(Number(line.kg))} กก.`;
      })
      .join("\n");
  } catch {
    return value;
  }
}

export function EntryDetails({
  entry: e,
  db,
  owner,
  voided = false,
  onChanged,
}: {
  entry: Entry;
  /** Resolves a Request's lot ids to PO numbers. */
  db?: Database;
  owner: boolean;
  /** A later "void" entry targets this one: no second cancel. */
  voided?: boolean;
  onChanged: (message: string) => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const reversible = reversibleKinds.includes(e.kind) && !voided;
  const cancelEntry = () => {
    setError("");
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
      setError(
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
            {/* A void has no lot, and its branch is only the config default. */}
            {[
              e.date,
              e.kind === "void" ? "" : e.lotId || e.branch,
              roleName[e.role],
            ]
              .filter(Boolean)
              .join(" · ")}
            {voided && " · ยกเลิกแล้ว"}
          </small>
          {/* Recorded on a later Bangkok day than its business date: owner audits these. */}
          {e.date <
            new Date(e.at).toLocaleDateString("en-CA", {
              timeZone: "Asia/Bangkok",
            }) && (
            <Badge tone="warning" className="ml-2">
              บันทึกย้อนหลัง
            </Badge>
          )}
          {/* The review's outcome and note to Chef House, readable without expanding. */}
          {e.kind === "invoiceReview" && (
            <small>
              {e.values.decision}
              {e.values.comment?.trim() &&
                ` · หมายเหตุถึง Chef House: ${e.values.comment.trim()}`}
            </small>
          )}
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
            value={
              k === "slips" ? (
                <SlipList value={v} />
              ) : k === "lines" &&
                ["shipmentRequest", "shipmentRequestEdit"].includes(e.kind) ? (
                <span className="whitespace-pre-line">
                  {requestLines(v, db)}
                </span>
              ) : (
                v
              )
            }
          />
        ))}
      <small className="text-text-secondary">
        บันทึก {new Date(e.at).toLocaleString("th-TH")}
      </small>
      <FormError error={error} className="mt-3.5" />
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
