"use client";

import { Button } from "@/components/atoms/Button";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { entries, titles, type Database, type EntryKind } from "@/lib/store";

const occasionalHint: Record<string, string> = {
  ricePurchase: "จดเฉพาะวันที่ซื้อ",
  riceIssue: "จดเฉพาะวันที่นึ่งเอง",
  rice: "จดเมื่อเบิกข้าวดิบวันนั้น",
};

export function DailyTaskTable({
  title,
  kinds,
  db,
  branch,
  date,
  open,
  required,
}: {
  title: string;
  kinds: EntryKind[];
  /** Kinds the day's summary counts as not jotted; the others only happen on some days.
   *  Omitted: the fixed occasional list. */
  required?: EntryKind[];
  db: Database;
  branch: string;
  date: string;
  open: (kind: EntryKind, lotId?: string) => void;
}) {
  return (
    <DataTable
      title={title}
      columns={["รายการ", "สถานะ", "จำนวนรายการ", "จด"]}
      rowKeys={kinds}
      rows={kinds.map((kind) => {
        const count = entries(db, kind, undefined, branch, date).length;
        const occasional = required
          ? !required.includes(kind)
          : kind === "ricePurchase";
        const label = titles[kind];
        return [
          occasional && occasionalHint[kind]
            ? `${label} · ${occasionalHint[kind]}`
            : label,
          count ? "จดแล้ว" : occasional ? "ยังไม่มีรายการ" : "ยังไม่ได้จด",
          String(count),
          <Button
            key={kind}
            variant="table-secondary"
            onClick={() => open(kind)}
          >
            จด
          </Button>,
        ];
      })}
    />
  );
}
