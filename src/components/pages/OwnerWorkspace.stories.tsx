import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useSelectedLayoutSegment } from "@storybook/nextjs-vite/navigation.mock";
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
import { ownerNav, type Tab } from "@/lib/nav";
import type { Database } from "@/lib/store";
import { OwnerWorkspace } from "./OwnerWorkspace";

// !autodocs: pages mount modal dialogs. Sidebar clicks only log router.push in Actions.
const meta: Meta = {
  title: "Pages/Owner",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;

type Args = { tab: Tab; account: "owner" | "manager"; db: Database };

// Every entry in `ownerNav`, in sidebar order, labelled "group · item".
const tabs = ownerNav.flatMap((group) =>
  group.items.map((item) => ({
    id: item.id,
    label: `${group.label} · ${item.label}`,
  })),
);

const data = pick("ข้อมูล", {
  "ปกติ (7 วัน)": demoDb,
  "Packing List พร้อมแล้ว": packedDb,
  "Foodiva มีงานรอ (badge)": foodivaTasksDb,
  รอทำใบขนส่ง: dispatchDb,
  ชุดหลายแบบ: foodivaBatchesDb,
  "Chef House มีงานรอ (badge)": chefBusyDb,
  "เปิดชุดเอง ยังไม่มี PO": chefOpenedDb,
  "Invoice ค่ารมถูกส่งกลับ": rejectedInvoiceDb,
  รมควันแล้ว: smokedDb,
  "ปิด Lot แล้ว (ขากลับ)": closedDb,
  พร้อมรับเข้าสต๊อกกลาง: centralDb,
});

/** Pick แท็บ, บัญชี and ข้อมูล in Controls. The tab is the URL segment
 *  (useSelectedLayoutSegment), mocked from the แท็บ control.
 *
 *  บัญชี = Account Manager (C4): the same workspace with no dashboard (opening it logs a
 *  router.replace to its home tab) and no sales money: PO without money, Report without
 *  LINE MAN and margin, Log with sales without amounts and no edit button.
 *
 *  ข้อมูล worth pairing with a tab:
 *  - ใบสั่ง PO โรงรมควัน: Packing List พร้อมแล้ว (saved, no smoke PO yet; bell and badge
 *    point here).
 *  - งาน Foodiva: Foodiva มีงานรอ, รอทำใบขนส่ง, ชุดหลายแบบ.
 *  - ชั่งรับเนื้อ / ผลิต · สโมค: Chef House มีงานรอ, เปิดชุดเอง ยังไม่มี PO, Invoice ค่ารม
 *    ถูกส่งกลับ, รมควันแล้ว (weigh-in lists shipment batches only, never a purchase PO).
 *  - เรียกรถขากลับ: ปิด Lot แล้ว (the lot is listed and the badge counts it).
 *  - รับเนื้อเข้าสต๊อกกลาง: พร้อมรับเข้าสต๊อกกลาง. */
export const Default: StoryObj<Args> = {
  argTypes: {
    tab: {
      name: "แท็บ",
      options: tabs.map((t) => t.id),
      control: {
        type: "select",
        labels: Object.fromEntries(tabs.map((t) => [t.id, t.label])),
      },
    },
    account: {
      name: "บัญชี",
      options: ["owner", "manager"],
      control: {
        type: "radio",
        labels: { owner: "Owner", manager: "Account Manager" },
      },
    },
    db: { ...data.argType, control: "select" },
  },
  args: { tab: "owner-dashboard", account: "owner", db: data.initial },
  // The render swaps the segment mock's implementation; put it back afterwards.
  beforeEach: () => () => useSelectedLayoutSegment.mockReset(),
  render: ({ tab, account }) => {
    useSelectedLayoutSegment.mockImplementation(() => tab);
    // key: a new tab or account is a fresh workspace (modal, chosen lot, optimistic tab).
    return (
      <OwnerWorkspace
        key={`${tab}:${account}`}
        account={accountById(account)!}
      />
    );
  },
};
