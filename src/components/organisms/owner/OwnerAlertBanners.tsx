"use client";

import { Button } from "@/components/atoms/Button";
import { Notice } from "@/components/molecules/Notice";
import type { noOwnerAlerts } from "@/components/organisms/owner/useOwnerAlerts";
import { fmt } from "@/lib/format";
import type { Tab } from "@/lib/nav";
import { produced, type Database } from "@/lib/store";

/**
 * The notes that sit above whichever tab the Owner has open: material settings that are
 * still incomplete, and lots Chef House has closed with no return trip recorded. Plain
 * facts in the neutral tone, never a demand. Each one hides on the tab its button leads
 * to. Renders nothing when there is nothing to say.
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
          action={
            <Button onClick={() => onTab("config")}>ไปหน้าตั้งค่า</Button>
          }
        >
          ตั้งค่าวัสดุยังไม่ครบ {alerts.missingMaterialSettings} รายการ ·
          ยังไม่ได้ตั้งจำนวนฐานหรือราคาต่อหน่วย
        </Notice>
      )}
      {alerts.returnReady.length > 0 && tab !== "return-shipment" && (
        <Notice
          action={
            <Button onClick={() => onTab("return-shipment")}>
              ไปหน้าเรียกรถขากลับ
            </Button>
          }
        >
          Chef House ปิด Lot แล้ว {alerts.returnReady.length} รายการ ·
          ยังไม่ได้จดรถขากลับ รวม{" "}
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
