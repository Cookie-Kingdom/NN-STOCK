"use client";

import { Button } from "@/components/atoms/Button";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { saveDatabase } from "@/lib/persistence";
import { seed, sevenDayRoleplay, thirtyDayRoleplay } from "@/lib/store";

export function ResetDataDialog({
  date,
  onClose,
  onDone,
}: {
  date: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  // Errors go to onDone as a message (not a form error), so this does not use useSaveMutation.
  const replace = (build: () => ReturnType<typeof sevenDayRoleplay>, message: string) => {
    try {
      saveDatabase(build());
      onDone(message);
    } catch (error) {
      onDone(error instanceof Error ? error.message : "บันทึกไม่ได้ กรุณาตรวจพื้นที่จัดเก็บเบราว์เซอร์");
    }
  };

  return (
    <Dialog title="รีเซ็ตข้อมูลระบบ?" className="w-112.5" onClose={onClose}>
      <DialogBody>
        <p className="mt-0 mb-5">ลบข้อมูลชุดปัจจุบันในเบราว์เซอร์นี้ ควรส่งออกก่อนหากต้องการเก็บไว้</p>
        <ButtonRow>
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button
            variant="secondary"
            onClick={() => replace(() => sevenDayRoleplay(date), "โหลดข้อมูลตัวอย่างครบ 7 วันแล้ว")}
          >
            ข้อมูลตัวอย่าง 7 วัน
          </Button>
          <Button
            variant="secondary"
            onClick={() => replace(() => thirtyDayRoleplay(date), "โหลดข้อมูลตัวอย่างครบ 30 วันแล้ว")}
          >
            ข้อมูลตัวอย่าง 30 วัน
          </Button>
          <Button
            variant="primary"
            onClick={() => replace(() => structuredClone(seed), "เริ่มชุดข้อมูลใหม่แล้ว")}
          >
            ยืนยันรีเซ็ต
          </Button>
        </ButtonRow>
      </DialogBody>
    </Dialog>
  );
}
