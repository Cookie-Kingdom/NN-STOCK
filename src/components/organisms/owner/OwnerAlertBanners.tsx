"use client";

import { Button } from "@/components/atoms/Button";
import { Notice } from "@/components/molecules/Notice";
import type { noOwnerAlerts } from "@/components/organisms/owner/useOwnerAlerts";
import { fmt } from "@/lib/format";
import type { Tab } from "@/lib/nav";
import { produced, type Database } from "@/lib/store";

/**
 * The warnings that sit above whichever tab the Owner has open: material settings that
 * are still incomplete, and lots Chef House has closed that need a return trip booked.
 * Each one hides on the tab that resolves it, so the tab its button leads to is never
 * also the tab nagging about it. Renders nothing when there is nothing to say.
 */
export function OwnerAlertBanners({
  db,
  alerts,
  tab,
  onTab,
}: {
  db: Database;
  alerts: Pick<typeof noOwnerAlerts, "missingMaterialSettings" | "returnReady">;
  tab: Tab;
  onTab: (tab: Tab) => void;
}) {
  return (
    <>
      {alerts.missingMaterialSettings > 0 && tab !== "config" && (
        <Notice
          tone="warning"
          action={
            <Button onClick={() => onTab("config")}>ไปหน้าตั้งค่า</Button>
          }
        >
          ตั้งค่าวัสดุยังไม่ครบ {alerts.missingMaterialSettings} รายการ
          กรุณากำหนดจำนวนฐานและราคาต่อหน่วยก่อนส่งวัสดุครั้งถัดไป
        </Notice>
      )}
      {alerts.returnReady.length > 0 && tab !== "return-shipment" && (
        <Notice
          tone="danger"
          action={
            <Button onClick={() => onTab("return-shipment")}>
              ไปเรียกรถขากลับ
            </Button>
          }
        >
          งานใหม่จาก Chef House · ปิด Lot แล้ว {alerts.returnReady.length}{" "}
          รายการ · ต้องเรียกรถขากลับรวม{" "}
          {fmt(
            alerts.returnReady.reduce(
              (total, item) => total + produced(db, item.id),
              0,
            ),
          )}{" "}
          กก.
        </Notice>
      )}
    </>
  );
}
