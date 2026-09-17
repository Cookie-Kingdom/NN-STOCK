import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { AppHeader } from "./AppHeader";
import { NotificationPopover, type Notification } from "./NotificationPopover";
import { PageHeading } from "./PageHeading";
import { Toast } from "./Toast";

const notifications: Notification[] = [
  {
    title: "ล็อต LOT-0915-01 รอรับเข้าสต๊อกกลาง",
    detail: "Chef_house ส่งมอบแล้ว",
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

export const Header: Story = {
  render: () => (
    <div className="min-h-120">
      <AppHeader actions={<Bell items={notifications} />} />
    </div>
  ),
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
  const [date, setDate] = useState("2020-01-01");
  return (
    <div className="p-6">
      <PageHeading
        overline="เจ้าของร้าน"
        title="ภาพรวมวันนี้"
        description="พิมพ์วันที่ก่อนวันเริ่มใช้ระบบ: มีคำเตือนใต้ช่องวันที่"
        date={date}
        onDate={setDate}
        minDate="2026-09-01"
      />
    </div>
  );
}

/** A typed date outside min/max (the picker alone does not stop typing). */
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
