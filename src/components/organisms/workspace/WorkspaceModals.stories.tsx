import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  demoDb,
  dispatchDb,
  dispatchedDb,
  packedDb,
  returnedDb,
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
  // What จดบันทึก opens: the kind on no lot. The lot is a field, on "ไม่ระบุ Lot".
  "จดบันทึก: รับเข้าสต๊อกกลาง (ไม่ระบุ Lot)": {
    account: "owner",
    db: returnedDb,
    kind: "central",
    lotId: "",
  },
  "จดบันทึก: ศาลาแดงรับเนื้อ (ไม่ระบุ Lot)": {
    account: "saladaeng",
    db: demoDb,
    kind: "receive",
    lotId: "",
  },
  // 「บันทึกและจดต่อ」 saves, says so at the top and leaves a fresh form on the same date.
  "จดบันทึก: ค่าใช้จ่าย (บันทึกและจดต่อ)": {
    account: "owner",
    db: demoDb,
    kind: "expense",
    lotId: "",
  },
  // STK-43: the branch writes down the chili it received; an ordinary entry form.
  "จดบันทึก: ศาลาแดงรับน้ำพริก (chiliReceive)": {
    account: "saladaeng",
    db: demoDb,
    kind: "chiliReceive",
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
 *  WorkspaceModals returns null.
 *
 *  The จดบันทึก cases open a kind with no lot, as the header's chooser does. On an entry
 *  form, 「บันทึกและจดต่อ」 saves (Actions panel), keeps the dialog open without replaying
 *  its enter, says what was saved at the top and puts focus back on the first field;
 *  the save button still saves and closes. No save moves the page to another tab. */
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
