"use client";

import { Button } from "@/components/atoms/Button";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { entries, titles, type Database } from "@/lib/store";

const optionalHint: Record<string, string> = {
  ricePurchase: "บันทึกเฉพาะวันที่ซื้อ",
  chiliPurchase: "บันทึกเฉพาะวันที่ซื้อ",
  riceIssue: "บันทึกเฉพาะวันที่นึ่งเอง",
  rice: "ต้องบันทึกเมื่อเบิกข้าวดิบวันนั้น",
};

export function DailyTaskTable({
  title,
  kinds,
  db,
  branch,
  date,
  disabled,
  hasLots,
  open,
  required,
}: {
  title: string;
  kinds: string[];
  /** Kinds owed today; the others read as optional. Omitted: the fixed optional list. */
  required?: string[];
  db: Database;
  branch: string;
  date: string;
  disabled: boolean;
  hasLots: boolean;
  open: (kind: string, lotId?: string) => void;
}) {
  return (
    <DataTable
      title={title}
      columns={["รายการ", "สถานะ", "จำนวนรายการ", "การทำงาน"]}
      rowKeys={kinds}
      rows={kinds.map((kind) => {
        const count = entries(db, kind, undefined, branch, date).length;
        const optional = required
          ? !required.includes(kind)
          : ["ricePurchase", "chiliPurchase"].includes(kind);
        const label = titles[kind];
        return [
          optional ? `${label} · ${optionalHint[kind] ?? "ไม่บังคับ"}` : label,
          count ? "บันทึกแล้ว" : optional ? "ไม่บังคับวันนี้" : "รอบันทึก",
          String(count),
          <Button
            key={kind}
            variant="table"
            disabled={disabled || (!hasLots && kind === "sale")}
            onClick={() => open(kind)}
          >
            กรอกข้อมูล
          </Button>,
        ];
      })}
    />
  );
}
