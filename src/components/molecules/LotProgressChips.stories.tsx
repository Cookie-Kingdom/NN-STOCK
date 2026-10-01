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

const progress = pick("ที่จดแล้ว", {
  "มีแค่ใบขนส่ง (ยังไม่ได้จด 11 รายการ)": dispatchDb,
  "สโมคแล้ว (ยังไม่ได้จด 6 รายการ)": smokedDb,
  "เข้าสต๊อกกลางแล้ว (ยังไม่ได้จดค่ารม)": centralDb,
  จดครบแล้ว: demoDb,
});

const steps = pick<readonly BatchStep[]>("รายการที่ดู", {
  ทุกรายการ: batchSteps,
  "เฉพาะงาน Chef House": ["cmReceive", "prepare", "smoke", "closeLot"],
});

type Args = { db: Database; steps: readonly BatchStep[] };

const meta: Meta<Args> = {
  title: "Molecules/LotProgressChips",
};

export default meta;

/** What a smoke batch still has no entry for (FoodivaView, SmokeOrderForm,
 *  LotWorkflowAction). เลือกใน Controls:
 *  - ที่จดแล้ว: "ยังไม่ได้จด" + หนึ่งชิปต่อรายการที่ยังไม่มี (ไม่เรียงลำดับ ไม่บังคับ)
 *    หรือชิปเขียว "จดครบแล้ว"
 *  - รายการที่ดู: `steps` จำกัดเฉพาะรายการที่หน้าจอนั้นสนใจ */
export const Default: StoryObj<Args> = {
  argTypes: { db: progress.argType, steps: steps.argType },
  args: { db: progress.initial, steps: steps.initial },
  render: ({ db, steps }) => (
    <LotProgressChips db={db} lotId={shipments(db)[0].id} steps={steps} />
  ),
};
