import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fireEvent, fn, within } from "storybook/test";
import { packedDb } from "../../../../.storybook/fixtures";
import { useOwnerAlerts } from "@/components/organisms/owner/useOwnerAlerts";
import { AppBrand, AppHeader } from "./AppHeader";
import { NotificationPopover, type Notification } from "./NotificationPopover";

const notifications: Notification[] = [
  {
    title: "ล็อต LOT-0915-01 รอรับเข้าสต๊อกกลาง",
    detail: "Chef House ส่งมอบแล้ว",
    tab: "work",
  },
  { title: "PO-0412 รอออกใบแจ้งหนี้", detail: "Foodiva", tab: "invoices" },
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

/** Pick การแจ้งเตือน in Controls:
 *  - ตัวอย่าง: two placeholder lines (a lot to receive, a PO to invoice).
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
        <AppHeader actions={<Bell items={items} />} />
      </div>
    );
  },
};
