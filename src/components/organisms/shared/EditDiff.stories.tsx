import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { changesDb, movedDb } from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import { EditDiff } from "./EntryDetails";

/** ศาลาแดง's edit of its sale: 65.5 → 60 kg and the LINE MAN amount. */
const edit = changesDb.entries.find((e) => e.kind === "entryEdit")!.values;
/** The Owner's edit that only moves a payment to another day and PO. */
const moved = movedDb.entries.at(-1)!.values;
const unchanged = Object.fromEntries(
  Object.entries(edit).map(([k, v]) =>
    k.startsWith("to.") ? [k, edit[`from.${k.slice(3)}`] ?? v] : [k, v],
  ),
);

const values = pick("การแก้ไข", {
  แก้ค่า: edit,
  "ย้ายวันที่และ Lot": moved,
  ไม่มีค่าที่เปลี่ยน: unchanged,
});

const meta = {
  title: "Organisms/Shared/EditDiff",
  component: EditDiff,
  argTypes: { values: values.argType },
  args: { values: values.initial, db: movedDb },
} satisfies Meta<typeof EditDiff>;

export default meta;

/** ก่อน → หลังของการแก้ไข แสดงเฉพาะค่าที่เปลี่ยน. เลือกใน Controls: การแก้ค่าของสาขา,
 *  การย้ายวันที่ทำรายการและ Lot (EDT-24) หรือการแก้ไขที่ไม่มีค่าเปลี่ยน ("ไม่มีค่าที่เปลี่ยน") */
export const Diff: StoryObj<typeof meta> = {};
