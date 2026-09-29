import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  centralDb,
  chefBusyDb,
  chefOpenedDb,
  closedDb,
  demoDb,
  dispatchDb,
  foodivaBatchesDb,
  foodivaTasksDb,
  packedDb,
  rejectedInvoiceDb,
  smokedDb,
} from "../../../.storybook/fixtures";
import { pick } from "../../../.storybook/pick";
import { accountById } from "@/lib/accounts";
import type { Tab } from "@/lib/nav";
import type { Database } from "@/lib/store";
import { OwnerWorkspace } from "./OwnerWorkspace";

// The tab comes from the URL segment (useSelectedLayoutSegment), so each story sets it.
// Sidebar clicks only log router.push in Actions. !autodocs: pages mount modal dialogs.
const at = (tab: Tab) => ({ nextjs: { navigation: { segments: [tab] } } });

type Args = { db: Database; account: "owner" | "manager" };

const meta: Meta<Args> = {
  title: "Pages/Owner",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: demoDb },
  render: ({ account = "owner" }) => (
    <OwnerWorkspace account={accountById(account)!} />
  ),
};

export default meta;
type Story = StoryObj<Args>;

/* Account Manager (C4): the same workspace with no dashboard in the sidebar and no sales
 * money. Report drops LINE MAN and the margin; History shows sales without amounts and no
 * edit button. The stories where it differs get a บัญชี control. */
const byAccount = {
  argTypes: {
    account: {
      name: "บัญชี",
      options: ["owner", "manager"],
      control: {
        type: "radio" as const,
        labels: { owner: "Owner", manager: "Account Manager" },
      },
    },
  },
  args: { account: "owner" as const },
};
const packingList = pick("สถานะ", {
  ปกติ: demoDb,
  "Packing List พร้อมแล้ว": packedDb,
});

/* The partners' tabs: the Owner (or Manager) types Foodiva's and Chef House's steps. */
const foodivaState = pick("สถานะ", {
  "มีงานรอ (badge)": foodivaTasksDb,
  รอทำใบขนส่ง: dispatchDb,
  ชุดหลายแบบ: foodivaBatchesDb,
});
const chefState = pick("สถานะ", {
  "มีงานรอ (badge)": chefBusyDb,
  "เปิดชุดเอง ยังไม่มี PO": chefOpenedDb,
  "Invoice ค่ารมถูกส่งกลับ": rejectedInvoiceDb,
  ปกติ: smokedDb,
});
const withAccount = (state: typeof foodivaState) => ({
  argTypes: { ...byAccount.argTypes, db: state.argType },
  args: { ...byAccount.args, db: state.initial },
});

/* One story per entry in `ownerNav`, in sidebar order, so a gap here is a gap the
 * Owner can see. The heading above each block is the sidebar group it belongs to. */

// ภาพรวม
export const Dashboard: Story = { parameters: at("owner-dashboard") };

// จัดซื้อและใบสั่ง
/** บัญชี = Account Manager: the same list without sales money. */
export const PurchaseOrders: Story = { ...byAccount, parameters: at("po") };
/** Pick สถานะ in Controls. Packing List พร้อมแล้ว: Packing List saved, no smoke PO yet;
 *  the bell and the smoke PO badge point here. */
export const SmokingPurchaseOrders: Story = {
  parameters: at("smoke-po"),
  argTypes: { db: packingList.argType },
  args: { db: packingList.initial },
};
export const Invoices: Story = { parameters: at("invoices") };

// งาน Foodiva
/** Invoice เนื้อ, the outbound transport document + Packing List and the freezer receipt,
 *  recorded for Foodiva. บัญชี = Account Manager gets the same tab. */
export const FoodivaWork: Story = {
  ...withAccount(foodivaState),
  parameters: at("foodiva"),
};

// งาน Chef House
/** Weigh-in at Chef House: shipment batches only, never a purchase PO. */
export const ChefReceive: Story = {
  ...withAccount(chefState),
  parameters: at("cm-receive"),
};
/** Pre-smoke, smoke, close Lot and the smoking invoice, then Chef House's stock table. */
export const ChefWork: Story = {
  ...withAccount(chefState),
  parameters: at("work"),
};

// ขนส่งและรับเข้า
export const TransportManifests: Story = { parameters: at("transport") };
/** Chef House closed the lot: the return-trip tab lists it and its badge counts it. */
export const ReturnShipment: Story = {
  parameters: { ...at("return-shipment"), db: closedDb },
};
export const CentralReceive: Story = {
  parameters: { ...at("central-receive"), db: centralDb },
};

// สต๊อกและสาขา
export const BranchStatus: Story = { parameters: at("branch-status") };
export const Stock: Story = { parameters: at("stock") };
export const MeatMovementLog: Story = { parameters: at("meat-log") };

// เอกสารและรายงาน
export const Documents: Story = { parameters: at("documents") };
/** บัญชี = Account Manager: no LINE MAN and no margin. */
export const Report: Story = { ...byAccount, parameters: at("report") };
/** บัญชี = Account Manager: sales without amounts and no edit button. */
export const History: Story = { ...byAccount, parameters: at("history") };

// ระบบ
export const Config: Story = { parameters: at("config") };
