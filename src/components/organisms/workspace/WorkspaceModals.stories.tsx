import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  centralDb,
  demoDb,
  dispatchDb,
  dispatchedDb,
  packedDb,
  smokedDb,
  smokeOrderDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import { setMockDatabase } from "../../../../.storybook/mocks/persistence";
import { accountById, type AccountId } from "@/lib/accounts";
import type { Database } from "@/lib/store";
import { useWorkspace } from "./useWorkspace";
import { WorkspaceModals } from "./WorkspaceModals";
import type { ModalKind } from "@/lib/nav";

// Every modal is a native <dialog>; a Docs page would stack them.
// Saves go through the mocked persistence and appear in the Actions panel.
const meta: Meta = {
  title: "Organisms/Workspace/WorkspaceModals",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;

type Case = {
  account: AccountId;
  db: Database;
  /** Left out for the no-modal case. */
  kind?: ModalKind;
  /** Left out: the account's first visible lot, exactly like `ws.open()`. */
  lotId?: string;
};

const last = (db: Database) => db.lots.at(-1)!.id;

const modal = pick<Case>("กล่องโต้ตอบ", {
  // An unknown-to-the-list kind falls through to `EntryForm`, keyed by kind + lot.
  "Owner: สร้าง PO": {
    account: "owner",
    db: demoDb,
    kind: "purchase",
    lotId: "",
  },
  // A branch account: `EntryForm` gets `branch` from the signed-in account.
  "ศาลาแดง: ขาย": { account: "saladaeng", db: demoDb, kind: "sale" },
  // "ส่งของไปสาขา": no lot; the chooser swaps it for the chili-tube allocation.
  ส่งวัสดุไปสาขา: { account: "owner", db: demoDb, kind: "materialTransfer" },
  "ส่งน้ำพริกหลอด (chiliAllocate)": {
    account: "owner",
    db: demoDb,
    kind: "chiliAllocate",
    lotId: "",
  },
  // "+ ซื้อเข้าคลัง"; the chooser swaps in the other purchase.
  ซื้อวัสดุเข้าคลัง: {
    account: "owner",
    db: demoDb,
    kind: "materialReceive",
    lotId: "",
  },
  "ซื้ออื่น ๆ (generalPurchase)": {
    account: "owner",
    db: demoDb,
    kind: "generalPurchase",
    lotId: "",
  },
  // `centralDb` has central kg ready to split.
  จัดสรรไปสาขา: {
    account: "owner",
    db: centralDb,
    kind: "allocate",
    lotId: last(centralDb),
  },
  "ใบขนส่ง Foodiva (dispatch)": {
    account: "owner",
    db: dispatchDb,
    kind: "dispatch",
    lotId: last(dispatchDb),
  },
  "แก้ Packing List": {
    account: "owner",
    db: packedDb,
    kind: "packingList",
    lotId: last(packedDb),
  },
  "ดู Packing List": {
    account: "owner",
    db: packedDb,
    kind: "packingListView",
    lotId: last(packedDb),
  },
  "สร้าง PO รมควัน": {
    account: "owner",
    db: demoDb,
    kind: "smokeOrder",
    lotId: "",
  },
  "ดู PO รมควัน": {
    account: "owner",
    db: smokeOrderDb,
    kind: "smokeOrderPreview",
    lotId: last(smokeOrderDb),
  },
  "Chef House รับเข้า (cmReceive)": {
    account: "owner",
    db: dispatchedDb,
    kind: "cmReceive",
    lotId: last(dispatchedDb),
  },
  "Chef House แก้ Lot": {
    account: "owner",
    db: smokedDb,
    kind: "chefEdit",
    lotId: last(smokedDb),
  },
  // The router renders nothing; the page keeps its own content.
  ปิดอยู่: { account: "owner", db: demoDb },
});

/** The router takes the whole workspace, so a story has to build a real one: sign in
 *  as `account`, open `kind` on the first render, then hand `ws` over untouched. */
function Modals({ account, kind, lotId }: Case) {
  const ws = useWorkspace(accountById(account)!);
  const [opened, setOpened] = useState(false);
  if (!opened) {
    setOpened(true);
    if (kind) ws.setModal({ kind, lotId: lotId ?? ws.lot?.id ?? "" });
  }
  return <WorkspaceModals ws={ws} />;
}

/** Pick กล่องโต้ตอบ in Controls: each option is what WorkspaceModals routes a `modal`
 *  kind to, opened on data where that dialog has something to show. ปิดอยู่: no modal,
 *  WorkspaceModals returns null. */
export const Default: StoryObj<{ modal: Case }> = {
  argTypes: { modal: { ...modal.argType, control: "select" } },
  args: { modal: modal.initial },
  render: ({ modal }) => {
    // ponytail: the case carries its own database, so set it before the workspace reads it.
    setMockDatabase(modal.db);
    return (
      <div className="p-6 text-body text-text-secondary">
        {!modal.kind &&
          "ไม่มีกล่องโต้ตอบเปิดอยู่ — WorkspaceModals คืนค่า null"}
        {/* key: a new case is a fresh workspace with its own first-render open. */}
        <Modals
          key={`${modal.account}:${modal.kind}:${modal.lotId}`}
          {...modal}
        />
      </div>
    );
  },
};
