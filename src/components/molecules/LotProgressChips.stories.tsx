import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  centralDb,
  demoDb,
  dispatchDb,
  smokedDb,
} from "../../../.storybook/fixtures";
import { pick } from "../../../.storybook/pick";
import {
  batchSteps,
  type BatchStep,
} from "@/components/organisms/owner/lotSteps";
import { shipments, type Database } from "@/lib/store";
import { LotProgressChips } from "./LotProgressChips";

const progress = pick("ความคืบหน้า", {
  "เพิ่งออกใบขนส่ง (ขาด 11 ขั้น)": dispatchDb,
  "สโมคแล้ว (ขาด 6 ขั้น)": smokedDb,
  "เข้าสต๊อกกลางแล้ว (ขาดค่ารม)": centralDb,
  ครบทุกขั้น: demoDb,
});

const steps = pick<readonly BatchStep[]>("ขั้นที่ดู", {
  ทุกขั้น: batchSteps,
  "เฉพาะงาน Chef House": ["cmReceive", "prepare", "smoke", "closeLot"],
});

type Args = { db: Database; steps: readonly BatchStep[] };

const meta: Meta<Args> = {
  title: "Molecules/LotProgressChips",
};

export default meta;

/** What a smoke batch still has no entry for (FoodivaView, SmokeOrderForm,
 *  LotWorkflowAction). เลือกใน Controls:
 *  - ความคืบหน้า: "ยังขาด" + หนึ่งชิปต่อขั้นที่ยังไม่บันทึก หรือชิปเขียว "ครบทุกขั้น"
 *  - ขั้นที่ดู: `steps` จำกัดเฉพาะขั้นที่หน้าจอนั้นสนใจ ครบแล้วอ่าน "ครบแล้ว" */
export const Default: StoryObj<Args> = {
  argTypes: { db: progress.argType, steps: steps.argType },
  args: { db: progress.initial, steps: steps.initial },
  render: ({ db, steps }) => (
    <LotProgressChips db={db} lotId={shipments(db)[0].id} steps={steps} />
  ),
};
