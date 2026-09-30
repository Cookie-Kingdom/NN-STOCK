"use client";

import { Button } from "@/components/atoms/Button";
import { Notice } from "@/components/molecules/Notice";
import { DataTable } from "@/components/organisms/shared/DataTable";
import type { CloseDayItem } from "@/lib/store";

/** What closing the day needs (closeDayChecklist, the same list mutate checks), with a
 *  way to go fill each missing item. `onGo` opens that item's form, or, for materials
 *  (counted on the ตรวจนับสต๊อกวัสดุวันนี้ tab), goes to that tab. An item with
 *  no form (the chill carried into tomorrow) is information and never blocks. */
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
        title="ตรวจก่อนปิดวัน"
        columns={["รายการ", "สถานะ", "ไปกรอก"]}
        rowKeys={items.map((item) => item.key)}
        rows={items.map((item) => [
          item.label,
          item.required
            ? item.done
              ? "✓"
              : "ยังไม่ทำ"
            : !item.kind
              ? "ข้อมูล · ไม่บังคับ"
              : item.done
                ? "✓ บันทึกแล้ว"
                : "ไม่บังคับ · ยังไม่บันทึก",
          (item.required || item.kind) && !item.done && onGo ? (
            <Button key={item.key} variant="table" onClick={() => onGo(item)}>
              {item.kind ? "ไปกรอก" : "ไปหน้าตรวจนับวัสดุ"}
            </Button>
          ) : (
            "-"
          ),
        ])}
      />
      {missing.length ? (
        <Notice tone="warning" role="status">
          ยังปิดวันไม่ได้ · ขาด {missing.map((item) => item.label).join(", ")}
        </Notice>
      ) : (
        <Notice tone="success" role="none">
          ข้อมูลครบ ปิดวันได้ทุกเวลา · ปิดแล้วยังบันทึกเพิ่มได้
        </Notice>
      )}
    </>
  );
}
