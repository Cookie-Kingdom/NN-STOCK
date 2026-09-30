import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { cmReceivedDb, packedDb } from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import { entries, type Values } from "@/lib/store";
import { PackingListSummary } from "./PackingListSummary";

const meta: Meta<typeof PackingListSummary> = {
  title: "Organisms/Shared/PackingListSummary",
  component: PackingListSummary,
};

export default meta;

const saved = entries(packedDb, "packingList").at(-1)!.values;

const list = pick("Packing List", {
  กรอกครบ: saved,
  "ไม่ได้กรอกยอดรวม ไม่มีไฟล์": {
    invoiceNo: "INV-1",
    product: "เนื้อวัว",
    attachment: "",
    slicedNetKg: "",
    missing: "attachment,slicedNetKg",
  },
} satisfies Record<string, Values>);

/** เลือกใน Controls:
 *  - กรอกครบ: Foodiva's file (named; a stored file opens with the button), box count and
 *    the total sent
 *  - ไม่ได้กรอกยอดรวม ไม่มีไฟล์: blank fields read "ยังไม่ได้กรอก" (GEN-02)
 *  - receivedKg: Chef House's weighed-in total under Foodiva's, once received (e.g. the
 *    49 kg of the "Chef House ชั่งแล้ว" fixture); clear it to hide the row */
export const Summary: StoryObj<{ values: Values; receivedKg?: string }> = {
  argTypes: { values: list.argType, receivedKg: { control: "text" } },
  args: {
    values: list.initial,
    receivedKg: cmReceivedDb.lots.at(-1)!.values.receivedKg,
  },
};
