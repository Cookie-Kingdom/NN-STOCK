"use client";

import { type ReactNode } from "react";
import { Button } from "@/components/atoms/Button";
import { CountPill } from "@/components/atoms/CountPill";
import { DataTable } from "@/components/organisms/shared/DataTable";
import type { Tab } from "@/lib/nav";
import {
  balance,
  closeDayChecklist,
  entries,
  pendingReceiveKg,
  cooksRice,
  requiredRiceKinds,
  type Database,
  type Lot,
} from "@/lib/store";

const taskKeys = ["receive", "thaw", "rice", "sale", "close"];

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
  open: (kind: string, lotId?: string) => void;
  /** ขั้นที่ 3 ไม่เปิด modal — มันพาไปแท็บข้าวเหนียววันนี้ ที่มีทุกฟอร์มของข้าว */
  onTab: (tab: Tab) => void;
}) {
  const pending = lots.filter(
    (lot) => pendingReceiveKg(db, lot.id, branch) > 0,
  );
  const frozen = lots.filter(
    (lot) => balance(db, lot.id, branch).frozen > 0.001,
  );
  const ready = lots.filter((lot) => balance(db, lot.id, branch).ready > 0.001);
  const saleDone = entries(db, "sale", undefined, branch, date).length > 0;
  // Which rice forms today owes: riceCarry always, plus rice once raw rice was issued.
  const riceRequired = requiredRiceKinds(db, branch, date);
  const riceMissing = riceRequired.filter(
    (kind) => entries(db, kind, undefined, branch, date).length === 0,
  );
  const missing = closeDayChecklist(db, branch, date).filter(
    (item) => item.required && !item.done,
  ).length;
  const tasks: ReactNode[][] = [
    [
      <strong key="receive">1. รับเนื้อเข้าสาขา</strong>,
      pending.length ? (
        <CountPill variant="task" key="new">
          งานเข้าใหม่ {pending.length} Lot
        </CountPill>
      ) : (
        "ไม่มีรายการรอรับ"
      ),
      pending.length ? (
        <Button
          variant="table"
          disabled={closed}
          onClick={() => open("receive", pending[0].id)}
        >
          รับของ
        </Button>
      ) : (
        "-"
      ),
    ],
    [
      <strong key="thaw">2. แบ่งละลายเนื้อ</strong>,
      frozen.length ? (
        <CountPill variant="task" key="need">
          ต้องเลือกเนื้อที่จะละลาย
        </CountPill>
      ) : (
        "ไม่มีเนื้อแช่แข็ง"
      ),
      frozen.length ? (
        <Button
          variant="table"
          disabled={closed}
          onClick={() => open("thaw", frozen[0].id)}
        >
          แบ่งละลาย
        </Button>
      ) : (
        "-"
      ),
    ],
    [
      <strong key="rice">
        {cooksRice(branch) ? "3. หุงข้าวเหนียว" : "3. ซื้อข้าวเหนียวสุก"}
      </strong>,
      riceMissing.length ? (
        <CountPill variant="task" key="rice-todo">
          ต้องบันทึกข้าวเหนียว {riceMissing.length} รายการก่อนปิดวัน
        </CountPill>
      ) : riceRequired.length ? (
        "บันทึกแล้ว"
      ) : (
        "วันนี้ไม่ต้องบันทึกข้าวเหนียว"
      ),
      <Button
        key="rice-action"
        variant="table"
        disabled={closed}
        onClick={() => onTab("rice")}
      >
        ไปเมนูข้าวเหนียววันนี้
      </Button>,
    ],
    [
      <strong key="sale">4. บันทึกยอดขาย</strong>,
      ready.length && !saleDone ? (
        <CountPill variant="task" key="sales">
          ต้องกรอกก่อนปิดวัน
        </CountPill>
      ) : saleDone ? (
        "บันทึกแล้ว"
      ) : (
        "รอเนื้อละลาย"
      ),
      ready.length ? (
        <Button
          variant="table"
          disabled={closed}
          onClick={() => open("sale", ready[0].id)}
        >
          บันทึกยอดขาย
        </Button>
      ) : (
        "-"
      ),
    ],
    [
      <strong key="close">5. ปิดวัน</strong>,
      closed
        ? "ปิดวันแล้ว · ข้อมูลวันนี้ถูกล็อก"
        : missing
          ? `ยังขาด ${missing} รายการก่อนปิดวัน`
          : "พร้อมปิดวัน",
      // The day screen's only close button: the dialog lists what is still missing.
      <Button
        key="close-action"
        variant="table"
        disabled={closed}
        onClick={() => open("closeDay")}
      >
        ตรวจและปิดวัน
      </Button>,
    ],
  ];
  return (
    <DataTable
      title={`งานหลักประจำวัน · ${branch}`}
      columns={["ลำดับงาน", "สถานะ", "ทำรายการ"]}
      rowKeys={taskKeys}
      rows={tasks}
    />
  );
}
