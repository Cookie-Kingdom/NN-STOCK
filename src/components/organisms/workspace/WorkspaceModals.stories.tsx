import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { centralDb, demoDb, multiPoDb } from "../../../../.storybook/fixtures";
import { accountById, type AccountId } from "@/lib/accounts";
import { useWorkspace } from "./useWorkspace";
import { WorkspaceModals } from "./WorkspaceModals";

// Every story opens a native modal <dialog>; a Docs page would stack them all.
// Saves go through the mocked persistence and appear in the Actions panel.
const meta: Meta = {
  title: "Organisms/WorkspaceModals",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

/** The router takes the whole workspace, so a story has to build a real one: sign in
 * as `account`, open `kind` on the first render, then hand `ws` over untouched. */
function Modals({
  account,
  kind,
  lotId,
}: {
  account: AccountId;
  /** Left out for the no-modal case. */
  kind?: string;
  /** Defaults to the account's first visible lot, exactly like `ws.open()`. */
  lotId?: string;
}) {
  const ws = useWorkspace(accountById(account)!);
  const [opened, setOpened] = useState(false);
  if (!opened) {
    setOpened(true);
    if (kind) ws.setModal({ kind, lotId: lotId ?? ws.lot?.id ?? "" });
  }
  return <WorkspaceModals ws={ws} />;
}

/** An unknown-to-the-list kind falls through to `EntryForm`, keyed by kind + lot. */
export const OwnerPurchase: Story = {
  parameters: { db: demoDb },
  render: () => <Modals account="owner" kind="purchase" lotId="" />,
};

/** A branch account: `EntryForm` gets `branch` from the signed-in account. */
export const BranchSale: Story = {
  parameters: { db: demoDb },
  render: () => <Modals account="saladaeng" kind="sale" />,
};

/** `materialTransfer` is in `CUSTOM_DIALOGS` — its own form, no lot involved. */
export const MaterialTransfer: Story = {
  parameters: { db: demoDb },
  render: () => <Modals account="owner" kind="materialTransfer" />,
};

/** `allocate` routes to `BagAllocationForm`; `centralDb` has bags ready to split. */
export const BagAllocation: Story = {
  parameters: { db: centralDb },
  render: () => (
    <Modals account="owner" kind="allocate" lotId={centralDb.lots[0].id} />
  ),
};

/** `chefEdit` routes to the Chef's lot-edit dialog for the lot it was opened on. */
export const ChefLotEdit: Story = {
  parameters: { db: centralDb },
  render: () => (
    <Modals account="chef" kind="chefEdit" lotId={centralDb.lots[0].id} />
  ),
};

/** `shipmentRequest` routes to the Owner's Request form, no lot involved. */
export const ShipmentRequest: Story = {
  parameters: { db: multiPoDb },
  render: () => <Modals account="owner" kind="shipmentRequest" lotId="" />,
};

/** No modal open: the router renders nothing, the page keeps its own content. */
export const Closed: Story = {
  parameters: { db: demoDb },
  render: () => (
    <div className="p-6 text-body text-text-secondary">
      ไม่มีกล่องโต้ตอบเปิดอยู่ — WorkspaceModals คืนค่า null
      <Modals account="owner" />
    </div>
  ),
};
