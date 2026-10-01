"use client";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  chiliReceived,
  n,
  offShelf,
  type Database,
  type EntryKind,
} from "@/lib/store";
import { fmt } from "@/lib/format";

export function ChiliDailySummary({
  db,
  branch,
  date,
  open,
}: {
  db: Database;
  branch: string;
  date: string;
  open: (kind: EntryKind, lotId?: string) => void;
}) {
  const receivedToDate = chiliReceived(db, branch, date);
  const soldBeforeToday = offShelf(db, undefined, branch)
    .filter((entry) => entry.date < date)
    .reduce((total, entry) => total + n(entry.values, "chiliSold"), 0);
  const salesToday = offShelf(db, undefined, branch, date);
  const soldToday = salesToday.reduce(
    (total, entry) => total + n(entry.values, "chiliSold"),
    0,
  );
  const opening = receivedToDate - soldBeforeToday;
  const expected = opening - soldToday;
  const latestCount = [...salesToday]
    .reverse()
    .find(
      (entry) =>
        entry.values.chiliCount !== "" && entry.values.chiliCount !== undefined,
    );
  const actual = latestCount ? n(latestCount.values, "chiliCount") : null;
  /* The count is judged against the figure it was made against (the sale's `chiliExpected`),
   * so chili received or cut after it does not turn a right count wrong. The stock rows above
   * keep following the receipts. */
  const countedAgainst =
    latestCount?.values.chiliExpected === undefined
      ? expected
      : n(latestCount.values, "chiliExpected");
  const mismatch = actual !== null && actual !== countedAgainst;
  return (
    <DataTable
      title="น้ำพริกหลอด · รับเข้า / สาขาตรวจสอบยอด"
      // STK-43: the branch writes down the chili it received.
      action={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => open("chiliReceive", "")}
        >
          รับน้ำพริกเข้าสาขา
        </Button>
      }
      columns={["รายการ", "จำนวน", "หน่วย / สถานะ"]}
      rows={[
        ["ยอดตั้งต้น", fmt(opening), "หลอด · รับเข้าสะสมหักที่ตัดสต๊อกแล้ว"],
        [
          "ตัดสต๊อกวันนี้ (ขาย + อินฟลูเอนเซอร์)",
          fmt(soldToday),
          "หลอด · ระบบหักให้อัตโนมัติ",
        ],
        ["ควรเหลือหลังตัดสต๊อก", fmt(expected), "หลอด"],
        [
          "ตรวจนับจริงปลายวัน",
          actual === null ? "ยังไม่ได้ตรวจนับ" : fmt(actual),
          actual === null ? (
            "กรอกได้ในฟอร์มยอดขาย"
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              {mismatch ? (
                <Badge tone="danger">ยอดไม่ตรง</Badge>
              ) : (
                <Badge tone="success">ตรงกัน</Badge>
              )}
              {/* Stock moved since the count: say what it was compared with. */}
              {countedAgainst !== expected &&
                `ตอนนับควรเหลือ ${fmt(countedAgainst)} หลอด`}
            </span>
          ),
        ],
        [
          "หมายเหตุส่วนต่าง",
          mismatch ? latestCount?.values.chiliRemark || "—" : "—",
          mismatch ? "ระบุเมื่อยอดไม่ตรง" : "",
        ],
      ]}
    />
  );
}
