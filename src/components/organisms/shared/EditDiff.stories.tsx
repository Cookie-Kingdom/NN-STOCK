import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { Values } from "@/lib/store";
import { editDecidedDb, editPendingDb } from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import { EditDiff } from "./EntryDetails";

/** The first entry in `db` that carries an edit's before → after. */
const diffOf = (values: Values[]) =>
  values.find((v) => Object.keys(v).some((k) => k.startsWith("to.")))!;

const request = diffOf(editPendingDb.entries.map((e) => e.values));
const decision = diffOf(
  editDecidedDb.entries
    .filter((e) => e.kind === "editDecision")
    .map((e) => e.values),
);
const unchanged = Object.fromEntries(
  Object.entries(request).map(([k, v]) =>
    k.startsWith("to.") ? [k, request[`from.${k.slice(3)}`] ?? v] : [k, v],
  ),
);

const values = pick("การแก้ไข", {
  คำขอแก้ไข: request,
  ผลการพิจารณา: decision,
  ไม่มีค่าที่เปลี่ยน: unchanged,
});

const meta: Meta<{ values: Values }> = {
  title: "Organisms/Shared/EditDiff",
  component: EditDiff,
  argTypes: { values: values.argType },
  args: { values: values.initial },
};

export default meta;

/** ก่อน → หลังของการแก้ไข แสดงเฉพาะค่าที่เปลี่ยน. เลือกใน Controls: คำขอแก้ไขที่รอ Owner,
 *  การแก้ไขหลังพิจารณา หรือคำขอที่ไม่มีค่าเปลี่ยน ("ไม่มีค่าที่เปลี่ยน") */
export const Diff: StoryObj<typeof meta> = {};
