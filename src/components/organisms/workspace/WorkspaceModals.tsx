"use client";

import {
  SegmentedChoice,
  type SegmentedOption,
} from "@/components/molecules/SegmentedChoice";
import { AllocationForm } from "@/components/organisms/shared/AllocationForm";
import { EntryForm } from "@/components/organisms/shared/EntryForm";
import { GeneralPurchaseForm } from "@/components/organisms/shared/GeneralPurchaseForm";
import { MaterialPurchaseForm } from "@/components/organisms/shared/MaterialPurchaseForm";
import { MaterialTransferForm } from "@/components/organisms/shared/MaterialTransferForm";
import { PackingListDialog } from "@/components/organisms/shared/PackingListDialog";
import { skipNextDialogEnter } from "@/components/organisms/shared/Dialog";
import { PackingListForm } from "@/components/organisms/shared/PackingListForm";
import { ChefLotEditForm } from "@/components/organisms/chef/ChefLotEditForm";
import { ChefReceiveForm } from "@/components/organisms/chef/ChefReceiveForm";
import { FoodivaDispatchForm } from "@/components/organisms/foodiva/FoodivaDispatchForm";
import { SmokeOrderPreviewDialog } from "@/components/organisms/chef/SmokeOrderPreviewDialog";
import { SmokeOrderForm } from "@/components/organisms/owner/SmokeOrderForm";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import type { ModalKind } from "@/lib/nav";
import { entries, titles, type EntryKind } from "@/lib/store";

const CUSTOM_DIALOGS = [
  "materialReceive",
  "generalPurchase",
  "materialTransfer",
  "packingList",
  "allocate",
  "chefEdit",
  "smokeOrderPreview",
  "cmReceive",
  "dispatch",
  "packingListView",
];

// The stock tab's two buttons each open a pair of forms: the first kind is what the
// button opens, the chooser swaps in the other. Each form still saves its own kind.
const STOCK_PAIRS: { label: string; options: SegmentedOption<ModalKind>[] }[] =
  [
    {
      label: "ซื้ออะไรเข้าคลัง",
      options: [
        { value: "materialReceive", label: "วัสดุบรรจุภัณฑ์" },
        { value: "generalPurchase", label: "ซื้ออื่น ๆ (น้ำพริก, น้ำดอง ฯลฯ)" },
      ],
    },
    {
      label: "ส่งอะไรไปสาขา",
      options: [
        { value: "materialTransfer", label: "วัสดุบรรจุภัณฑ์" },
        { value: "chiliAllocate", label: "น้ำพริกหลอด" },
      ],
    },
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
  };
  const done = (message: string) => {
    setToast(message);
    setModal(null);
  };
  const pair = STOCK_PAIRS.find((item) =>
    item.options.some((option) => option.value === modal.kind),
  );
  const switcher = pair && (
    <SegmentedChoice
      label={pair.label}
      options={pair.options}
      value={modal.kind}
      onChange={(kind) => {
        skipNextDialogEnter();
        setModal({ kind, lotId: "" });
      }}
    />
  );

  if (modal.kind === "materialTransfer") {
    return (
      <MaterialTransferForm
        switcher={switcher}
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
        switcher={switcher}
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
        switcher={switcher}
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
        onSaved={(next) => {
          // Nag for a smoke PO only when the batch has none yet (free ledger: it may come later).
          const lotId = next.entries.findLast(
            (e) => e.kind === "dispatch",
          )?.lotId;
          done(
            lotId && entries(next, "smokeOrder", lotId).length
              ? "บันทึกใบขนส่งและ Packing List แล้ว"
              : "บันทึกใบขนส่งและ Packing List แล้ว · แจ้ง Owner ออก PO รมควัน",
          );
        }}
      />
    );
  }
  if (modal.kind === "allocate") {
    return (
      <AllocationForm
        db={db}
        lotId={modal.lotId}
        {...dateProps}
        onClose={close}
        onSaved={(summary) => done(`จัดสรรไปสาขาแล้ว · ${summary}`)}
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
  if (modal.kind === "smokeOrder") {
    return (
      <SmokeOrderForm
        db={db}
        lotId={modal.lotId}
        {...dateProps}
        onClose={close}
        onSaved={(next) => {
          setChosen(next.lots.at(-1)?.id || chosen);
          done(savedMessage(titles.smokeOrder));
        }}
      />
    );
  }
  if (modal.kind === "smokeOrderPreview") {
    return (
      <SmokeOrderPreviewDialog db={db} lotId={modal.lotId} onClose={close} />
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
      onOpen={ws.open}
      switcher={switcher}
      onSaved={(next) => {
        setChosen(next.lots.at(-1)?.id || chosen);
        if (modal.kind === "purchase") {
          setTab("po");
          done(
            "สร้างใบ PO แล้ว · รอ Foodiva ยืนยัน Invoice และน้ำหนักก่อนทำใบขนส่ง",
          );
        } else {
          done(savedMessage(titles[modal.kind as EntryKind]));
        }
      }}
    />
  );
}
