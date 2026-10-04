import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/atoms/Button";
import {
  WithWorkspace,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { liveEntries, type Values } from "@/lib/store";
import { PoDocumentDialog } from "./PoDocumentDialog";

/** Opens on load; closing leaves a button to open it again. */
const Opened = ({
  kind,
  entryId,
  values,
}: {
  kind: "purchase" | "smokeOrder";
  entryId?: string;
  values?: Values;
}) => {
  const [open, setOpen] = useState(true);
  return (
    <WithWorkspace>
      {(ws) => (
        <>
          <Button onClick={() => setOpen(true)}>เปิด PO</Button>
          {ws.toast.message && (
            <p role="status" className="mt-3 text-body-sm text-success">
              {ws.toast.message}
            </p>
          )}
          {open && (
            <PoDocumentDialog
              ws={ws}
              kind={kind}
              entryId={entryId}
              values={values}
              onClose={() => setOpen(false)}
            />
          )}
        </>
      )}
    </WithWorkspace>
  );
};

const meta = {
  title: "Organisms/Shared/PoDocumentDialog",
  component: Opened,
  // A modal <dialog> would stack on a Docs page.
  tags: ["!autodocs"],
  args: { kind: "purchase" },
  argTypes: { kind: { control: false }, entryId: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Opened>;

export default meta;
type Story = StoryObj<typeof meta>;

/** PO เนื้อ ฉบับร่าง: ฟอร์มแบ่งหมวดทางซ้าย กระดาษ PO ทางขวาเปลี่ยนตามทันที · พิมพ์ได้ก่อนบันทึก (เลขที่ถัดไป ติด ฉบับร่าง) ·
 *  สถานะเอกสารเป็นจุดและคำในบรรทัดใต้ชื่อ ไม่ใช่ป้าย */
export const PurchaseDraft: Story = {
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

/** PO รมควัน ฉบับร่าง: ราคาค่ารมเว้นว่าง 「เว็บคิดให้」 บอกราคาตามขั้นน้ำหนักใน Settings และยอดรวม
 *  (1,200 กก. ใช้ราคาขั้น 1,000 กก.) */
export const SmokeOrderDraft: Story = {
  args: { kind: "smokeOrder", values: { rawKg: "1200" } },
};

/** PO เนื้อที่บันทึกแล้ว: จุดเขียว บันทึกแล้ว เลข PO จริง · แก้ช่องใดก็เปลี่ยนเป็น แก้ไขยังไม่บันทึก แล้วบันทึกเป็นการแก้ไข */
export const SavedPurchase: Story = {
  args: {
    entryId: liveEntries(sampleDb).find((e) => e.kind === "purchase")?.id,
  },
};

/** มือถือ 390px: เต็มจอ ฟอร์มและกระดาษเรียงต่อกันในพื้นที่เลื่อนเดียว */
export const Mobile: Story = { ...PurchaseDraft, ...phone };
