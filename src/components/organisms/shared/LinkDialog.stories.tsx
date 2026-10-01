import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { linkedDb, unlinkedDb } from "../../../../.storybook/fixtures";
import { setMockDatabase } from "../../../../.storybook/mocks/persistence";
import { pick } from "../../../../.storybook/pick";
import { entries, type Database, type EntryKind } from "@/lib/store";
import { LinkDialog } from "./LinkDialog";

// A native modal <dialog>; a Docs page would stack it behind the other stories.
const meta: Meta = {
  title: "Organisms/Shared/LinkDialog",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: unlinkedDb },
};

export default meta;

/** The target as `entries()` shows it, with any earlier link overlaid. */
const target = (db: Database, kind: EntryKind) =>
  entries(db, kind).find((e) => e.branch === "ศาลาแดง")!;

const scenario = pick("รายการที่ผูก", {
  "เนื้อสาขา (ยังไม่ผูก)": {
    db: unlinkedDb,
    kind: "receive" as EntryKind,
    role: "branch" as const,
    branch: "ศาลาแดง" as string | undefined,
  },
  "Owner ผูกใหม่": {
    db: linkedDb,
    kind: "receive" as EntryKind,
    role: "owner" as const,
    branch: undefined as string | undefined,
  },
});

/** เลือกใน Controls:
 *  - เนื้อสาขา: ศาลาแดงรับ 10 kg ไม่มี Lot; ตัวเลือกคือทุก batch ที่ส่งพร้อมยอดที่เหลือใน
 *    สต๊อกกลาง; บันทึกแล้วเป็น `link` และยอดย้ายไป batch นั้น
 *  - Owner ผูกใหม่: รายการรับที่ผูก batch แล้ว "ผูกอยู่กับ" บอกชื่อ และบันทึก batch เดิมซ้ำ
 *    ไม่ได้; link หลังสุดชนะ (LNK-05) */
export const Link: StoryObj<{ scenario: typeof scenario.initial }> = {
  argTypes: { scenario: scenario.argType },
  args: { scenario: scenario.initial },
  render: ({ scenario: { db, kind, role, branch } }) => {
    // The decorator only sees `parameters.db`; saving re-reads the picked db.
    setMockDatabase(db);
    return (
      <LinkDialog
        key={`${kind}-${role}`}
        entry={target(db, kind)}
        db={db}
        role={role}
        branch={branch}
        onClose={fn()}
        onLinked={fn()}
      />
    );
  },
};
