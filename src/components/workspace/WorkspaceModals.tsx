"use client";

import { BagAllocationForm } from "@/components/shared/BagAllocationForm";
import { EntryForm } from "@/components/shared/EntryForm";
import { GeneralPurchaseForm } from "@/components/shared/GeneralPurchaseForm";
import { MaterialPurchaseForm } from "@/components/shared/MaterialPurchaseForm";
import { MaterialTransferForm } from "@/components/shared/MaterialTransferForm";
import { ChefLotEditForm } from "@/components/chef/ChefLotEditForm";
import { SmokeOrderPreviewDialog } from "@/components/chef/SmokeOrderPreviewDialog";
import type { Workspace } from "@/components/workspace/useWorkspace";
import { titles } from "@/lib/store";

const CUSTOM_DIALOGS = [
  "materialReceive",
  "generalPurchase",
  "materialTransfer",
  "allocate",
  "chefEdit",
  "smokeOrderPreview",
];

export function WorkspaceModals({ ws }: { ws: Workspace }) {
  const { db, role, date, modal, setModal, setToast, chosen, setChosen, setTab } = ws;
  if (!modal) return null;
  const close = () => setModal(null);
  const done = (message: string) => {
    setToast(message);
    setModal(null);
  };

  if (modal.kind === "materialTransfer") {
    return (
      <MaterialTransferForm
        key={`material-transfer-${date}`}
        db={db}
        date={date}
        onClose={close}
        onSaved={() => done("บันทึกส่งวัสดุไปสาขาแล้ว")}
      />
    );
  }
  if (modal.kind === "materialReceive") {
    return (
      <MaterialPurchaseForm
        key={`material-purchase-${date}`}
        db={db}
        date={date}
        onClose={close}
        onSaved={() => done("บันทึกการซื้อวัสดุแล้ว")}
      />
    );
  }
  if (modal.kind === "generalPurchase") {
    return (
      <GeneralPurchaseForm
        key={`general-purchase-${date}`}
        date={date}
        onClose={close}
        onSaved={() => done("บันทึกการซื้ออื่น ๆ แล้ว")}
      />
    );
  }
  if (modal.kind === "allocate") {
    return (
      <BagAllocationForm
        db={db}
        lotId={modal.lotId}
        date={date}
        onClose={close}
        onSaved={() => done("จัดสรรถุงเนื้อไปสาขาแล้ว")}
      />
    );
  }
  if (modal.kind === "chefEdit") {
    return (
      <ChefLotEditForm
        db={db}
        lotId={modal.lotId}
        onClose={close}
        onSaved={() => done("แก้ไขข้อมูล Lot แล้ว · ตรวจสอบก่อนกดยืนยันปิด Lot")}
      />
    );
  }
  if (modal.kind === "smokeOrderPreview") {
    return <SmokeOrderPreviewDialog db={db} lotId={modal.lotId} onClose={close} />;
  }
  if (CUSTOM_DIALOGS.includes(modal.kind)) return null;

  return (
    <EntryForm
      key={`${modal.kind}-${modal.lotId}`}
      db={db}
      role={role}
      date={date}
      modal={modal}
      onClose={close}
      onSaved={(next) => {
        setChosen(next.lots.at(-1)?.id || chosen);
        if (modal.kind === "purchase") {
          setTab("po");
          done("สร้างใบ PO แล้ว · รอ Food Diva ยืนยัน Invoice และน้ำหนักก่อนทำใบขนส่ง");
        } else {
          done(`บันทึก${titles[modal.kind]}แล้ว`);
        }
      }}
    />
  );
}
