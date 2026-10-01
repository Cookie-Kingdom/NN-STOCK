"use client";

import { type ReactNode } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { NO_LOT, type Tab } from "@/lib/nav";
import {
  balance,
  closeDayChecklist,
  entries,
  requiredRiceKinds,
  type Database,
  type Lot,
  type EntryKind,
} from "@/lib/store";

const taskKeys = ["receive", "thaw", "rice", "sale", "close"];

/** จดวันนี้: what a branch can jot on `date`, in any order. Nothing here waits on
 *  anything else (the store only warns), so every button is live; the status column
 *  only says what is and is not jotted yet. */
export function BranchDailyWorkflow({
  db,
  branch,
  date,
  lots,
  closed,
  open,
  onTab,
}: {
  db: Database;
  branch: string;
  date: string;
  lots: Lot[];
  closed: boolean;
  open: (kind: EntryKind, lotId?: string) => void;
  /** ข้าวเหนียวไม่เปิด modal — มันพาไปแท็บข้าวเหนียววันนี้ ที่มีทุกฟอร์มของข้าว */
  onTab: (tab: Tab) => void;
}) {
  /* The lot a thaw or sale form opens on: the first batch holding that meat, else the
   * "ไม่ระบุ Lot" bucket (BR-03, `lotId ""`, opened as NO_LOT). With no such meat at all
   * the form still opens on the bucket, and the store warns about the stock. */
  const holding = (key: "frozen" | "ready") =>
    [...lots.map((lot) => lot.id), ""].find(
      (id) => balance(db, id, branch)[key] > 0.001,
    );
  const frozen = holding("frozen");
  const jotted = (kind: EntryKind) =>
    entries(db, kind, undefined, branch, date).length > 0;
  // riceCarry every day, plus rice once raw rice was issued.
  const riceMissing = requiredRiceKinds(db, branch, date).filter(
    (kind) => !jotted(kind),
  ).length;
  const missing = closeDayChecklist(db, branch, date).filter(
    (item) => item.required && !item.done,
  ).length;
  // Not jotted yet is a plain fact, never an alarm: neutral chip, and the text says it.
  const notYet = (key: string, count?: number) => (
    <Badge key={key}>ยังไม่ได้จด{count ? ` ${count} รายการ` : ""}</Badge>
  );
  const tasks: ReactNode[][] = [
    [
      <strong key="receive">รับเนื้อเข้าสาขา</strong>,
      "จดเนื้อที่รับเข้าสาขา · เลือก Lot ต้นทาง (ไม่รู้ Lot เลือก ไม่ระบุ Lot แล้วผูกทีหลัง)",
      // BR-01/08: the branch jots what it received, on any batch or none.
      <Button
        key="receive-action"
        variant="table-secondary"
        onClick={() => open("receive", "")}
      >
        รับของ
      </Button>,
    ],
    [
      <strong key="thaw">แบ่งละลายเนื้อ</strong>,
      jotted("thaw")
        ? "จดแล้ว"
        : frozen === undefined
          ? "ไม่มีเนื้อแช่แข็ง"
          : notYet("thaw-status"),
      <Button
        key="thaw-action"
        variant="table-secondary"
        onClick={() => open("thaw", frozen || NO_LOT)}
      >
        แบ่งละลาย
      </Button>,
    ],
    [
      <strong key="rice">ข้าวเหนียว</strong>,
      riceMissing ? notYet("rice-status", riceMissing) : "จดครบแล้ว",
      <Button
        key="rice-action"
        variant="table-secondary"
        onClick={() => onTab("rice")}
      >
        ไปเมนูข้าวเหนียววันนี้
      </Button>,
    ],
    [
      <strong key="sale">ยอดขาย</strong>,
      jotted("sale") ? "จดแล้ว" : notYet("sale-status"),
      <Button
        key="sale-action"
        variant="table-secondary"
        // Sold before the thaw was jotted: the batch still frozen is the likely one.
        onClick={() => open("sale", holding("ready") || frozen || NO_LOT)}
      >
        จดยอดขาย
      </Button>,
    ],
    [
      <strong key="close">ปิดวัน</strong>,
      closed
        ? "ปิดวันแล้ว · ยังจดเพิ่มได้"
        : missing
          ? notYet("close-status", missing)
          : "จดครบแล้ว",
      // The day screen's only close button: the dialog lists what is not jotted yet.
      <Button
        key="close-action"
        variant="table-secondary"
        disabled={closed}
        onClick={() => open("closeDay")}
      >
        ตรวจและปิดวัน
      </Button>,
    ],
  ];
  return (
    <DataTable
      title={`จดวันนี้ · ${branch}`}
      columns={["รายการ", "สถานะ", "จด"]}
      rowKeys={taskKeys}
      rows={tasks}
    />
  );
}
