import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/atoms/Button";
import {
  WithWorkspace,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { SkuDialog } from "./SkuDialog";

/** Opens on load; closing leaves a button to open it again. */
const Opened = () => {
  const [open, setOpen] = useState(true);
  return (
    <WithWorkspace account="owner">
      {(ws) => (
        <>
          <Button onClick={() => setOpen(true)}>เปิดรายการ</Button>
          {ws.toast.message && (
            <p role="status" className="mt-3 text-body-sm text-success">
              {ws.toast.message}
            </p>
          )}
          {open && <SkuDialog ws={ws} onClose={() => setOpen(false)} />}
        </>
      )}
    </WithWorkspace>
  );
};

const meta = {
  title: "Organisms/Owner/SkuDialog",
  component: Opened,
  tags: ["!autodocs"],
  parameters: { db: sampleDb },
} satisfies Meta<typeof Opened>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ทุก SKU กับชื่อ แสดงทีละ 10 แถว กด「ดูเพิ่มเติม」เพื่อดูต่อ · วัสดุอ่านอย่างเดียว
 *  รายการในบัญชีซื้อพิมพ์ชื่อใหม่ได้ แล้ว「บันทึก」(กดได้เมื่อมีชื่อที่เปลี่ยน) ·
 *  ชื่อซ้ำหรือชื่อว่าง เว็บไม่รับ ข้อความสีแดงขึ้นข้างปุ่ม */
export const Default: Story = {};

/** พิมพ์ในช่องค้นหา: เหลือเฉพาะแถวที่ SKU หรือชื่อตรง */
export const Search: Story = {
  play: async ({ canvas, userEvent }) =>
    userEvent.type(await canvas.findByRole("searchbox"), "ถุง"),
};

/** จอ 390px: เต็มจอ */
export const Phone: Story = { ...phone };
