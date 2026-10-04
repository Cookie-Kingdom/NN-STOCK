import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Button } from "@/components/atoms/Button";
import {
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { liveEntries, type Database, type Entry } from "@/lib/store";
import { DevConfirmDelete } from "./DevPopups";

/** Opens on load; closing leaves the button a row's 「ลบ」 would be. Nothing is deleted. */
const Opened = ({
  db,
  entry,
  onClose,
  onConfirm,
}: {
  db: Database;
  entry: Entry;
  onClose: () => void;
  onConfirm: () => void;
}) => {
  const [open, setOpen] = useState(true);
  const close = (then: () => void) => () => {
    then();
    setOpen(false);
  };
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        ลบ
      </Button>
      {open && (
        <DevConfirmDelete
          db={db}
          entry={entry}
          onClose={close(onClose)}
          onConfirm={close(onConfirm)}
        />
      )}
    </>
  );
};

const meta = {
  title: "Develop/Popups/Confirm delete",
  component: Opened,
  // A modal <dialog> would stack on a Docs page.
  tags: ["!autodocs"],
  args: {
    db: sampleDb,
    entry: liveEntries(sampleDb).find(
      (e) => e.kind === "pay" && e.values.supplier,
    )!,
    onClose: fn(),
    onConfirm: fn(),
  },
  argTypes: { db: { control: false }, entry: { control: false } },
} satisfies Meta<typeof Opened>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ใหม่ — ยังไม่มีในแอป (วันนี้กด 「ลบ」 แล้วลบทันที มี 「เลิกทำ」 บน toast):
 *  บอกว่ากำลังลบบันทึกไหน ผลที่ตามมา และเริ่มที่ปุ่ม ยกเลิก */
export const Default: Story = {};

/** ลบการส่งไปรม: บันทึกที่ไม่มียอดเงิน สรุปเหลือ 3 บรรทัด */
export const Dispatch: Story = {
  args: { entry: liveEntries(sampleDb).find((e) => e.kind === "dispatch")! },
};

/** จอ 390px: เป็น bottom sheet ชิดล่างจอ ไม่เต็มจอ ปุ่มกว้างเท่ากัน */
export const Phone: Story = { ...phone };
