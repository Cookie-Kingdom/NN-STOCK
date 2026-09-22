import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { packedDb } from "../../../../.storybook/fixtures";
import { useOwnerAlerts } from "@/components/organisms/owner/useOwnerAlerts";
import { AppBrand, AppHeader } from "./AppHeader";
import { NotificationPopover, type Notification } from "./NotificationPopover";
import { PageHeading } from "./PageHeading";
import { DatabaseErrorToast, Toast } from "./Toast";

const notifications: Notification[] = [
  {
    title: "ล็อต LOT-0915-01 รอรับเข้าสต๊อกกลาง",
    detail: "Chef House ส่งมอบแล้ว",
    tab: "work",
  },
  { title: "PO-0412 รอออกใบแจ้งหนี้", detail: "Foodiva", tab: "invoices" },
];

const meta = {
  title: "Organisms/Workspace",
  component: AppHeader,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

function Bell({ items }: { items: Notification[] }) {
  const [open, setOpen] = useState(true);
  return (
    <NotificationPopover
      notifications={items}
      open={open}
      onToggle={() => setOpen((value) => !value)}
      onSelect={fn()}
    />
  );
}

/** The brand block on its own: the header and the sign-in card both render it. */
export const Brand: Story = {
  render: () => (
    <div className="grid gap-6 p-6">
      <AppBrand />
      {/* responsive: the title drops to h3 below md, so the sign-in card fits a phone. */}
      <AppBrand responsive />
    </div>
  ),
};

export const Header: Story = {
  render: () => (
    <div className="min-h-120">
      <AppHeader actions={<Bell items={notifications} />} />
    </div>
  ),
};

/** Owner's bell once Foodiva saved the transport document with its Packing List (P4):
 * "Packing List พร้อมแล้ว" leads to the smoke PO tab. */
export const HeaderPackingListReady: Story = {
  render: function Render() {
    const { notifications } = useOwnerAlerts(packedDb);
    return (
      <div className="min-h-80">
        <AppHeader actions={<Bell items={notifications} />} />
      </div>
    );
  },
};

export const HeaderNoNotifications: Story = {
  render: () => (
    <div className="min-h-60">
      <AppHeader actions={<Bell items={[]} />} />
    </div>
  ),
};

function Heading() {
  const [date, setDate] = useState("2026-09-15");
  const [toast, setToast] = useState("บันทึกเรียบร้อยแล้ว");
  return (
    <div className="p-6">
      <PageHeading
        overline="เจ้าของร้าน"
        title="ภาพรวมวันนี้"
        description="สรุปยอดขาย ต้นทุน และงานที่ต้องทำต่อ"
        date={date}
        onDate={setDate}
      />
      <button
        type="button"
        className="text-caption text-accent underline"
        onClick={() =>
          setToast(
            `บันทึกเรียบร้อยแล้ว ${new Date().toLocaleTimeString("th-TH")}`,
          )
        }
      >
        แสดงข้อความใหม่
      </button>
      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}

export const PageHeadingWithToast: Story = { render: () => <Heading /> };

function OutOfRangeHeading() {
  const [date, setDate] = useState("2099-01-01");
  return (
    <div className="p-6">
      <PageHeading
        overline="เจ้าของร้าน"
        title="ภาพรวมวันนี้"
        description="พิมพ์วันที่หลังวันนี้: มีคำเตือนใต้ช่องวันที่"
        date={date}
        onDate={setDate}
      />
    </div>
  );
}

/** A typed date after today (the picker's `max` alone does not stop typing). */
export const PageHeadingDateOutOfRange: Story = {
  render: () => <OutOfRangeHeading />,
};

/** What DatabaseErrorToast shows when save_app_state refuses a save. */
export const ErrorToast: Story = {
  render: () => (
    <div className="p-6">
      <Toast
        tone="danger"
        message="บันทึกไม่สำเร็จ โหลดข้อมูลล่าสุดแล้ว · State changed on another device. Reload and try again."
        onClose={fn()}
      />
    </div>
  ),
};

/** DatabaseErrorToast listens for the `database-error` event persistence.ts dispatches. */
export const DatabaseError: Story = {
  render: () => (
    <div className="p-6">
      <button
        type="button"
        className="text-caption text-accent underline"
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent("database-error", {
              detail:
                "บันทึกไม่สำเร็จ โหลดข้อมูลล่าสุดแล้ว · State changed on another device.",
            }),
          )
        }
      >
        จำลองข้อผิดพลาดจากฐานข้อมูล
      </button>
      <DatabaseErrorToast />
    </div>
  ),
};
