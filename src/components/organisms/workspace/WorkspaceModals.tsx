"use client";

import { BagAllocationForm } from "@/components/organisms/shared/BagAllocationForm";
import { EntryForm } from "@/components/organisms/shared/EntryForm";
import { GeneralPurchaseForm } from "@/components/organisms/shared/GeneralPurchaseForm";
import { MaterialPurchaseForm } from "@/components/organisms/shared/MaterialPurchaseForm";
import { MaterialTransferForm } from "@/components/organisms/shared/MaterialTransferForm";
import { PackingListDialog } from "@/components/organisms/shared/PackingListDialog";
import { PackingListForm } from "@/components/organisms/shared/PackingListForm";
import { ChefLotEditForm } from "@/components/organisms/chef/ChefLotEditForm";
import { ChefReceiveForm } from "@/components/organisms/chef/ChefReceiveForm";
import { FoodivaDispatchForm } from "@/components/organisms/foodiva/FoodivaDispatchForm";
import { SmokeOrderPreviewDialog } from "@/components/organisms/chef/SmokeOrderPreviewDialog";
import { ShipmentRequestForm } from "@/components/organisms/owner/ShipmentRequestForm";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { titles } from "@/lib/store";

const CUSTOM_DIALOGS = [
  "materialReceive",
  "generalPurchase",
  "materialTransfer",
  "packingList",
  "allocate",
  "chefEdit",
  "smokeOrderPreview",
  "shipmentRequest",
  "cmReceive",
  "dispatch",
  "packingListView",
];

// "ยืนยันปิด Lot" + "แล้ว" needs a space after a Latin word; Thai-to-Thai stays joined.
const savedMessage = (title: string) =>
  `${title}${/[A-Za-z0-9.)]$/.test(title) ? " " : ""}แล้ว`;

export function WorkspaceModals({ ws }: { ws: Workspace }) {
  const {
    db,
    role,
    branch,
    date,
    modal,
    setModal,
    setToast,
    chosen,
    setChosen,
    setTab,
    setDate,
  } = ws;
  if (!modal) return null;
  const close = () => setModal(null);
  // Forms edit the one workspace date, so the page's date-derived data follows.
  const dateProps = {
    date,
    onDate: setDate,
    minDate: db.config.systemStartDate,
  };
  const done = (message: string) => {
    setToast(message);
    setModal(null);
  };

  if (modal.kind === "materialTransfer") {
    return (
      <MaterialTransferForm
        db={db}
        {...dateProps}
        onClose={close}
        onSaved={() => done("บันทึกส่งวัสดุไปสาขาแล้ว")}
      />
    );
  }
  if (modal.kind === "materialReceive") {
    return (
      <MaterialPurchaseForm
        db={db}
        {...dateProps}
        onClose={close}
        onSaved={() => done("บันทึกการซื้อวัสดุแล้ว")}
      />
    );
  }
  if (modal.kind === "generalPurchase") {
    return (
      <GeneralPurchaseForm
        {...dateProps}
        onClose={close}
        onSaved={() => done("บันทึกการซื้ออื่น ๆ แล้ว")}
      />
    );
  }
  if (modal.kind === "packingList") {
    return (
      <PackingListForm
        db={db}
        lotId={modal.lotId}
        {...dateProps}
        onClose={close}
        onSaved={() => done("บันทึก Packing List แล้ว")}
      />
    );
  }
  if (modal.kind === "packingListView") {
    return (
      <PackingListDialog
        db={db}
        lotId={modal.lotId}
        onClose={close}
        showPurchaseOrders={role === "owner"}
      />
    );
  }
  if (modal.kind === "dispatch") {
    return (
      <FoodivaDispatchForm
        db={db}
        lotId={modal.lotId}
        {...dateProps}
        onClose={close}
        onSaved={() =>
          done("บันทึกใบขนส่งและ Packing List แล้ว · แจ้ง Owner ออก PO รมควัน")
        }
      />
    );
  }
  if (modal.kind === "allocate") {
    return (
      <BagAllocationForm
        db={db}
        lotId={modal.lotId}
        {...dateProps}
        onClose={close}
        onSaved={() => done("จัดสรรกล่องรมควันไปสาขาแล้ว")}
      />
    );
  }
  if (modal.kind === "chefEdit") {
    return (
      <ChefLotEditForm
        db={db}
        lotId={modal.lotId}
        {...dateProps}
        onClose={close}
        onSaved={() =>
          done("แก้ไขข้อมูล Lot แล้ว · ตรวจสอบก่อนกดยืนยันปิด Lot")
        }
      />
    );
  }
  if (modal.kind === "cmReceive") {
    return (
      <ChefReceiveForm
        db={db}
        lotId={modal.lotId}
        {...dateProps}
        onClose={close}
        onSaved={() => done(savedMessage(titles.cmReceive))}
      />
    );
  }
  if (modal.kind === "smokeOrderPreview") {
    return (
      <SmokeOrderPreviewDialog db={db} lotId={modal.lotId} onClose={close} />
    );
  }
  if (modal.kind === "shipmentRequest") {
    return (
      <ShipmentRequestForm
        db={db}
        {...dateProps}
        onClose={close}
        onSaved={(next) => {
          setChosen(next.lots.at(-1)?.id || chosen);
          done("สร้าง Request แล้ว · รอ Foodiva ทำใบขนส่ง");
        }}
      />
    );
  }
  if (CUSTOM_DIALOGS.includes(modal.kind)) return null;

  return (
    <EntryForm
      key={`${modal.kind}-${modal.lotId}`}
      db={db}
      role={role}
      branch={branch}
      {...dateProps}
      modal={modal}
      onClose={close}
      onSaved={(next) => {
        setChosen(next.lots.at(-1)?.id || chosen);
        if (modal.kind === "purchase") {
          setTab("po");
          done(
            "สร้างใบ PO แล้ว · รอ Foodiva ยืนยัน Invoice และน้ำหนักก่อนทำใบขนส่ง",
          );
        } else {
          done(savedMessage(titles[modal.kind]));
        }
      }}
    />
  );
}
