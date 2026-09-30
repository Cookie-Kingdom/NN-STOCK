import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  day,
  dispatchDb,
  nextDay,
  packedDb,
  packedThenOrderedDb,
  repeatDispatchDb,
} from "../../../../.storybook/fixtures";
import { setMockDatabase } from "../../../../.storybook/mocks/persistence";
import { pick } from "../../../../.storybook/pick";
import { entries, type Database, type Values } from "@/lib/store";
import { today } from "@/lib/format";
import { PackingListForm } from "./PackingListForm";

// A native modal <dialog>; a Docs page would stack it behind the other stories.
const meta: Meta = {
  title: "Organisms/Shared/PackingListForm",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;

/** `draft`: the form hands its values back (onDraft) instead of saving; a Values object
 *  reopens that earlier draft. */
type Setup = { db: Database; draft?: true | Values };
type Story = StoryObj<{ state: Setup; date: string }>;

const savedList = entries(packedDb, "packingList").at(-1)!.values;

const state = pick("สถานะ", {
  "ร่าง · Request ครั้งแรก": { db: dispatchDb, draft: true },
  "ร่าง · Request ครั้งถัดไป": { db: repeatDispatchDb, draft: true },
  "ร่าง · เปิดร่างเดิมกลับมา": { db: dispatchDb, draft: savedList },
  แก้ไขรายการที่บันทึกแล้ว: { db: packedDb },
  "แก้ไขหลังออก PO รมควัน": { db: packedThenOrderedDb },
} satisfies Record<string, Setup>);

const dates = pick("วันที่", {
  "วันตัวอย่าง (ย้อนหลัง)": day,
  วันถัดไป: nextDay,
  วันนี้: today(),
});

/** เลือกสถานะใน Controls:
 *  - ร่าง (inside Foodiva's transport form): seeded from the Request's POs and handed back
 *    as a draft. Invoice and product carry their source. Foodiva attaches the file and
 *    types the total sent (Sliced Weight Net) and, if it has it, the box count; Sliced
 *    Weight Lost is the gap between Inv. Weight and the total. Blank fields still save,
 *    marked "ยังไม่ได้กรอก".
 *    - ครั้งแรก: Inv. Weight is the 50 kg this Request asks of its purchase PO
 *    - ครั้งถัดไป: the CODE comes from the last Packing List ("ล่าสุด 09/09"), and Inv.
 *      Weight follows this Request — 40 kg, not the first trip's 50
 *    - เปิดร่างเดิมกลับมา: Foodiva reopens a draft (2 boxes, 50 kg) before saving
 *  - แก้ไขรายการที่บันทึกแล้ว: the "ชุดรมควัน" row of a batch Foodiva opened, before any
 *    smoke PO: no Inv. Weight, so Sliced Weight Lost stays 0.00
 *  - แก้ไขหลังออก PO รมควัน (SHP-02): still editable, with a warning to have the Owner
 *    re-check the PO's kg; Inv. Weight is now the PO's 50 kg */
export const PackingList: Story = {
  argTypes: { state: state.argType, date: dates.argType },
  args: { state: state.initial, date: dates.initial },
  render: ({ state: { db, draft }, date }) => {
    // ponytail: the preview decorator only syncs an arg named `db`; this one sits in `state`.
    setMockDatabase(db);
    return (
      <PackingListForm
        // Keyed so a Controls change reopens the dialog fresh.
        key={`${db.entries.length}:${typeof draft}:${date}`}
        db={db}
        lotId={db.lots.at(-1)!.id}
        date={date}
        onDate={fn()}
        onClose={fn()}
        {...(draft
          ? { onDraft: fn(), draft: draft === true ? undefined : draft }
          : { onSaved: fn() })}
      />
    );
  },
};
