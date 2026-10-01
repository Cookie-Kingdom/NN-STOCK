"use client";

import { Button } from "@/components/atoms/Button";
import { Notice } from "@/components/molecules/Notice";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { missingText, type CloseDayItem } from "@/lib/store";

/** What the day holds so far (closeDayChecklist, the same list mutate warns about), with
 *  a way to jot each item still empty. `onGo` opens that item's form, or, for materials
 *  (counted on the ตรวจนับสต๊อกวัสดุวันนี้ tab), goes to that tab. An item with
 *  no form (the chill carried into tomorrow) is information. Nothing here blocks closing. */
export function CloseDayChecklist({
  items,
  onGo,
}: {
  items: CloseDayItem[];
  onGo?: (item: CloseDayItem) => void;
}) {
  const missing = items.filter((item) => item.required && !item.done);
  return (
    <>
      <DataTable
        title="สรุปก่อนปิดวัน"
        columns={["รายการ", "สถานะ", "จด"]}
        rowKeys={items.map((item) => item.key)}
        rows={items.map((item) => [
          item.label,
          !item.kind && !item.required
            ? "ข้อมูล"
            : item.done
              ? "จดแล้ว"
              : "ยังไม่ได้จด",
          (item.required || item.kind) && !item.done && onGo ? (
            <Button
              key={item.key}
              variant="table-secondary"
              onClick={() => onGo(item)}
            >
              {item.kind ? "จด" : "ไปหน้าตรวจนับวัสดุ"}
            </Button>
          ) : (
            "-"
          ),
        ])}
      />
      {missing.length ? (
        <Notice role="status">
          ยังไม่ได้จด {missing.length} รายการ ·{" "}
          {missing.map((item) => item.label).join(", ")} · ปิดวันได้
          ช่องที่เว้นไว้จะขึ้นว่า{missingText}
        </Notice>
      ) : (
        <Notice tone="success" role="none">
          จดครบแล้ว · ปิดวันได้ทุกเวลา · ปิดแล้วยังจดเพิ่มได้
        </Notice>
      )}
    </>
  );
}
