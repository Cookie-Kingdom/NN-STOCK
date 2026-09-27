import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { pick } from "../../../.storybook/pick";
import { Button } from "@/components/atoms/Button";
import { FormError } from "./FormError";
import { Notice } from "./Notice";

const meta = {
  title: "Molecules/Notice",
  component: Notice,
  args: { children: "บันทึกรับเนื้อเข้าเรียบร้อยแล้ว" },
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["info", "success", "warning", "danger"],
    },
  },
} satisfies Meta<typeof Notice>;

export default meta;
type Story = StoryObj<typeof meta>;

const dismiss = pick("onDismiss", { ไม่มี: undefined, มีปุ่มปิด: fn() });
const action = pick("action", {
  ไม่มี: undefined,
  ปุ่มไปที่ตั้งค่า: <Button variant="primary">ไปที่ตั้งค่า</Button>,
});

/** Pick the state in Controls:
 *  - `tone`: info (e.g. "ยังไม่มีการตั้งค่าสาขา"), success, warning (e.g.
 *    "สต๊อกกลางเหลือน้อยกว่า 10 กก."), danger (e.g. "บันทึกไม่สำเร็จ กรุณาลองใหม่")
 *  - `onDismiss`: adds the close button
 *  - `action`: a button on the right (e.g. "เริ่มต้นใช้งานด้วยการตั้งค่าราคาเนื้อ" +
 *    ไปที่ตั้งค่า) */
export const Default: Story = {
  argTypes: {
    children: { control: "text" },
    onDismiss: dismiss.argType,
    action: action.argType,
  },
  args: { tone: "info", onDismiss: dismiss.initial, action: action.initial },
};

export const FormErrorMessage: Story = {
  render: () => <FormError error="กรุณากรอกน้ำหนักให้มากกว่า 0" />,
};
