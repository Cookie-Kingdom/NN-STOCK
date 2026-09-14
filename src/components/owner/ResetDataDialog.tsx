"use client";

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
  const replace = (build: () => ReturnType<typeof sevenDayRoleplay>, message: string) => {
    try {
      saveDatabase(build());
      onDone(message);
    } catch (error) {
      onDone(error instanceof Error ? error.message : "บันทึกไม่ได้ กรุณาตรวจพื้นที่จัดเก็บเบราว์เซอร์");
    }
  };

  return (
    <div className="modal-backdrop">
      <section role="dialog" aria-modal="true" aria-label="รีเซ็ตข้อมูล" className="reset-panel">
        <h2>รีเซ็ตข้อมูลระบบ?</h2>
        <p>ลบข้อมูลชุดปัจจุบันในเบราว์เซอร์นี้ ควรส่งออกก่อนหากต้องการเก็บไว้</p>
        <div className="button-row">
          <button className="secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            className="secondary"
            onClick={() => replace(() => sevenDayRoleplay(date), "โหลดข้อมูลตัวอย่างครบ 7 วันแล้ว")}
          >
            ข้อมูลตัวอย่าง 7 วัน
          </button>
          <button
            className="secondary"
            onClick={() => replace(() => thirtyDayRoleplay(date), "โหลดข้อมูลตัวอย่างครบ 30 วันแล้ว")}
          >
            ข้อมูลตัวอย่าง 30 วัน
          </button>
          <button
            className="primary"
            onClick={() => replace(() => structuredClone(seed), "เริ่มชุดข้อมูลใหม่แล้ว")}
          >
            ยืนยันรีเซ็ต
          </button>
        </div>
      </section>
    </div>
  );
}
