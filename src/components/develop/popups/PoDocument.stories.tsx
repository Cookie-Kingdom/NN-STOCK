import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Button } from "@/components/atoms/Button";
import {
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { accountById } from "@/lib/accounts";
import { today } from "@/lib/format";
import { liveEntries, type Entry, type Values } from "@/lib/store";
import { DevPoDocument } from "./DevPopups";

/** Opens on load; closing leaves a button to open it again. Nothing is saved. */
const Opened = ({
  onClose,
  ...props
}: {
  kind: "purchase" | "smokeOrder";
  saved?: Entry;
  values?: Values;
  saving?: boolean;
  error?: string;
  onClose: () => void;
  onSave: (values: Values) => void;
}) => {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>เปิด PO</Button>
      {open && (
        <DevPoDocument
          {...props}
          db={sampleDb}
          by={accountById("owner")!}
          today={today()}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        />
      )}
    </>
  );
};

const meta = {
  title: "Develop/Popups/PO document",
  component: Opened,
  // A modal <dialog> would stack on a Docs page.
  tags: ["!autodocs"],
  args: { kind: "purchase", onClose: fn(), onSave: fn() },
  argTypes: { kind: { control: false }, saved: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Opened>;

export default meta;
type Story = StoryObj<typeof meta>;

/** PO เนื้อ ฉบับร่าง: ฟอร์มแบ่งหมวดทางซ้าย กระดาษ PO ทางขวา ·
 *  สถานะเอกสารเป็นจุดและคำในบรรทัดใต้ชื่อ ไม่ใช่ป้าย */
export const Purchase: Story = {
  args: {
    values: {
      supplier: "Foodiva",
      orderedKg: "1200",
      wasteKg: "35",
      price: "310",
      productName: "เนื้อวัวส่วนอก",
    },
  },
};

/** PO รมควัน ฉบับร่าง: ราคาค่ารมเว้นว่าง 「เว็บคิดให้」 บอกราคาตามขั้นน้ำหนักและยอดรวม */
export const SmokeOrder: Story = {
  args: { kind: "smokeOrder", values: { rawKg: "1200" } },
};

/** PO เนื้อที่บันทึกแล้ว: จุดเขียว บันทึกแล้ว · แก้ช่องใดก็เปลี่ยนเป็น แก้ไขยังไม่บันทึก */
export const SavedPurchase: Story = {
  args: { saved: liveEntries(sampleDb).find((e) => e.kind === "purchase") },
};

/** จอ 390px: เต็มจอ ฟอร์มและกระดาษเรียงต่อกันในพื้นที่เลื่อนเดียว */
export const Phone: Story = { ...Purchase, ...phone };
