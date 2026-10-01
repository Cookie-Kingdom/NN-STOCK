"use client";

import { useState } from "react";
import {
  SegmentedChoice,
  type SegmentedOption,
} from "@/components/molecules/SegmentedChoice";
import { EntryForm } from "@/components/organisms/shared/EntryForm";
import { GeneralPurchaseForm } from "@/components/organisms/shared/GeneralPurchaseForm";
import { MaterialPurchaseForm } from "@/components/organisms/shared/MaterialPurchaseForm";
import { MaterialTransferForm } from "@/components/organisms/shared/MaterialTransferForm";
import { PackingListDialog } from "@/components/organisms/shared/PackingListDialog";
import { skipNextDialogEnter } from "@/components/organisms/shared/Dialog";
import { PackingListForm } from "@/components/organisms/shared/PackingListForm";
import { ChefLotEditForm } from "@/components/organisms/owner/ChefLotEditForm";
import { ChefReceiveForm } from "@/components/organisms/owner/ChefReceiveForm";
import { FoodivaDispatchForm } from "@/components/organisms/owner/FoodivaDispatchForm";
import { MatchPurchasePoDialog } from "@/components/organisms/owner/MatchPurchasePoDialog";
import { SmokeOrderPreviewDialog } from "@/components/organisms/owner/SmokeOrderPreviewDialog";
import { SmokeOrderForm } from "@/components/organisms/owner/SmokeOrderForm";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import type { Modal, ModalKind } from "@/lib/nav";
import { titles, type EntryKind } from "@/lib/store";

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
  /* 「บันทึกและจดต่อ」: the open form again, fresh, on the lot the last entry was saved on.
   * Tied to the `modal` object it was saved in, so the next dialog opened starts clean. */
  const [more, setMore] = useState<{
    modal: Modal;
    count: number;
    lot: string;
    note: string;
  }>();
  if (!modal) return null;
  const again = more?.modal === modal ? more : undefined;
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
        onSaved={(next) =>
          // SHP-03: the Packing List is optional; name only what was saved.
          done(
            next.entries.at(-1)?.kind === "packingList"
              ? "บันทึกใบขนส่งและ Packing List แล้ว"
              : "บันทึกใบขนส่งแล้ว",
          )
        }
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
        onSaved={() => done("แก้ไขข้อมูล Lot แล้ว")}
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
  if (modal.kind === "matchPo") {
    return (
      <MatchPurchasePoDialog
        db={db}
        lotId={modal.lotId}
        onClose={close}
        onSaved={done}
      />
    );
  }
  if (modal.kind === "smokeOrderPreview") {
    return (
      <SmokeOrderPreviewDialog db={db} lotId={modal.lotId} onClose={close} />
    );
  }

  return (
    <EntryForm
      key={`${modal.kind}-${modal.lotId}-${again?.count ?? 0}`}
      db={db}
      role={role}
      branch={branch}
      {...dateProps}
      modal={modal}
      onClose={close}
      onOpen={ws.open}
      onTab={setTab}
      switcher={switcher}
      again={again}
      onSaved={(next) => {
        setChosen(next.lots.at(-1)?.id || chosen);
        done(savedMessage(titles[modal.kind as EntryKind]));
      }}
      onSavedMore={(next, lot) => {
        setChosen(next.lots.at(-1)?.id || chosen);
        const note = savedMessage(titles[modal.kind as EntryKind]);
        setToast(note);
        // The form remounts in place: no second enter, focus back on its first field.
        skipNextDialogEnter("[data-autofocus]");
        setMore({ modal, count: (again?.count ?? 0) + 1, lot, note });
      }}
    />
  );
}
