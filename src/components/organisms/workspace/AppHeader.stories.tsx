import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fireEvent, fn, within } from "storybook/test";
import { packedDb } from "../../../../.storybook/fixtures";
import { useOwnerAlerts } from "@/components/organisms/owner/useOwnerAlerts";
import { accountById } from "@/lib/accounts";
import { AppBrand, AppHeader } from "./AppHeader";
import { NotificationPopover, type Notification } from "./NotificationPopover";
import { QuickAdd } from "./QuickAdd";

const notifications: Notification[] = [
  {
    title: "Foodiva รับเนื้อรมควันแล้ว 1 Lot",
    detail: "ยังไม่ได้จดรับเข้าสต๊อกกลาง",
    tab: "central-receive",
  },
  {
    title: "ยังไม่ได้จด Invoice เนื้อ · F260915-001",
    detail: "น้ำหนักที่ยืนยันและ Invoice เนื้อของ Foodiva",
    tab: "foodiva",
  },
];

const meta = {
  title: "Organisms/Workspace/AppHeader",
  component: AppHeader,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppHeader>;

export default meta;

function Bell({ items }: { items: Notification[] }) {
  return <NotificationPopover notifications={items} onSelect={fn()} />;
}

/** The bell's panel is a native popover: click the bell so the story opens on the list. */
const openBell = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  fireEvent.click(
    within(canvasElement).getByRole("button", { name: /^การแจ้งเตือน/ }),
  );
};

/** The brand block on its own: the header and the sign-in card both render it.
 *  Toggle responsive: the title drops to h3 below md, so the sign-in card fits a phone. */
export const Brand: StoryObj<{ responsive: boolean }> = {
  argTypes: { responsive: { name: "responsive", control: "boolean" } },
  args: { responsive: false },
  render: ({ responsive }) => (
    <div className="p-6">
      <AppBrand responsive={responsive} />
    </div>
  ),
};

type Alerts = "sample" | "packingList" | "none";

/** The header as a workspace renders it: จดบันทึก, the bell, the theme toggle. Below md
 *  (viewport toolbar) the three take a row of their own under the brand and จดบันทึก
 *  fills it.
 *
 *  The bell lists notices as plain facts: its count pill is neutral and the panel reads
 *  "แจ้งเตือน N รายการ" / "ไม่มีแจ้งเตือน" (the same strings on the branch route). Pick การแจ้งเตือน in Controls:
 *  - ตัวอย่าง: two sample lines (a lot not in central stock, a PO with no invoice).
 *  - Packing List พร้อมแล้ว: the Owner's bell once Foodiva saved the transport document
 *    with its Packing List (P4); "Packing List พร้อมแล้ว" leads to the smoke PO tab.
 *  - ไม่มี: an empty bell. */
export const Header: StoryObj<{ alerts: Alerts }> = {
  argTypes: {
    alerts: {
      name: "การแจ้งเตือน",
      options: ["sample", "packingList", "none"],
      control: {
        type: "radio",
        labels: {
          sample: "ตัวอย่าง",
          packingList: "Packing List พร้อมแล้ว",
          none: "ไม่มี",
        },
      },
    },
  },
  args: { alerts: "sample" },
  play: openBell,
  render: function Render({ alerts }) {
    const packingList = useOwnerAlerts(packedDb).notifications;
    const items = { sample: notifications, packingList, none: [] }[alerts];
    return (
      <div className="min-h-120">
        <AppHeader
          actions={
            <>
              <QuickAdd
                account={accountById("owner")!}
                onOpen={fn()}
                onTab={fn()}
              />
              <Bell items={items} />
            </>
          }
        />
      </div>
    );
  },
};
