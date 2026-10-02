import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { DatabaseErrorToast, Toast } from "./Toast";

const meta = {
  title: "Molecules/Toast",
  component: Toast,
  args: { message: "บันทึกเรียบร้อยแล้ว", tone: "success", onClose: fn() },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Toast's parent clears the message on close, so the story owns it too. */
function Dismissable({
  initial,
  tone,
  onClose,
}: {
  initial: string;
  tone?: "success" | "danger";
  onClose: () => void;
}) {
  const [message, setMessage] = useState(initial);
  return (
    <Toast
      tone={tone}
      message={message}
      onClose={() => {
        setMessage("");
        onClose();
      }}
    />
  );
}

/** เลือกใน Controls:
 *  - `tone` success: บันทึกสำเร็จ
 *  - `tone` danger: ฐานข้อมูลปฏิเสธการบันทึก (ข้อความเดียวกับ DatabaseErrorToast)
 *  - `message` ว่าง: ไม่แสดงอะไรเลย; เปลี่ยนข้อความแล้ว fade-up เล่นใหม่
 *  - ปุ่ม × ปิดข้อความ · ข้อความ success ปิดเองใน 6 วินาที ส่วน danger อยู่จนกดปิด */
export const Default: Story = {
  argTypes: {
    tone: { control: "inline-radio", options: ["success", "danger"] },
    message: { control: "text" },
  },
  render: ({ message, tone, onClose }) => (
    <Dismissable
      key={`${tone}|${message}`}
      initial={message}
      tone={tone}
      onClose={onClose}
    />
  ),
};

/** ลบแล้ว: มีปุ่ม「เลิกทำ」 กดแล้วทำงานและปิดข้อความ · ข้อความสีเขียวปิดเองใน 6 วินาที */
export const WithUndo: Story = {
  args: {
    message: "ลบแล้ว: ยอดขาย",
    action: { label: "เลิกทำ", onClick: fn() },
  },
};

const refusal =
  "บันทึกไม่สำเร็จ โหลดข้อมูลล่าสุดแล้ว · State changed on another device.";

/** DatabaseErrorToast listens for the `database-error` event persistence.ts dispatches
 *  when a load or save fails; the button fires one. */
export const DatabaseError: Story = {
  render: () => (
    <>
      <button
        type="button"
        className="text-caption text-accent underline"
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent("database-error", { detail: refusal }),
          )
        }
      >
        จำลองข้อผิดพลาดจากฐานข้อมูล
      </button>
      <DatabaseErrorToast />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /จำลอง/ }));
    const toast = await canvas.findByText(refusal);
    // animate-fade-up starts at opacity 0.
    await waitFor(() => expect(toast).toBeVisible());
  },
};
