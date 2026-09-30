import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  branchTasksDb,
  centralDb,
  closeReadyDb,
  day,
  demoDb,
  freeOrderDb,
  linkedDb,
  nextDay,
  open,
  ownerReservedDb,
  partialBatchDb,
  unlinkedDb,
  unmatchedPoDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import type { Tab } from "@/lib/nav";
import type { Database } from "@/lib/store";
import { CentralReceiveView } from "./CentralReceiveView";
import { ConfigView } from "./ConfigView";
import { MeatMovementLogView } from "./MeatMovementLogView";
import { OwnerAlertBanners } from "./OwnerAlertBanners";
import { OwnerDailyStatus } from "./OwnerDailyStatus";
import { OwnerDashboard } from "./OwnerDashboard";
import { OwnerStockView } from "./OwnerStockView";
import { Report } from "./Report";
import { SimpleTraceabilityView } from "./SimpleTraceabilityView";

const db = demoDb;

const meta: Meta = {
  title: "Organisms/Owner",
  parameters: { db },
};

export default meta;
type Story = StoryObj<{ db: Database }>;

/* A logo saved before logos moved to storage is a data URL in config; it still shows.
 * New uploads go to storage (IndexedDB only in Storybook) and config keeps the key. */
const legacyLogoDb = {
  ...db,
  config: {
    ...db.config,
    logoName: "logo.png",
    logoData:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  },
};

const stockState = pick("สถานะ", {
  ตัวอย่าง: db,
  "Waste รอรับ": ownerReservedDb,
  "ไม่ระบุ Lot": unlinkedDb,
});
const linkState = pick("สถานะ", {
  ตัวอย่าง: db,
  ยังไม่ผูก: unlinkedDb,
  ผูกแล้ว: linkedDb,
});
const traceState = pick("สถานะ", {
  ตัวอย่าง: db,
  ยังไม่ผูก: unlinkedDb,
  ชุดที่มีแค่รับและรมควัน: partialBatchDb,
});
const centralState = pick("สถานะ", {
  ตัวอย่าง: db,
  สต๊อกกลางพร้อม: centralDb,
  ไม่มีรถกลับ: freeOrderDb,
  "ยังไม่จับคู่ PO ซื้อ": unmatchedPoDb,
});
const dailyState = pick("สถานะ", {
  ตัวอย่าง: db,
  ปิดวันได้: closeReadyDb,
  งานรอ: branchTasksDb,
});
const logoState = pick("โลโก้", { ปกติ: db, โลโก้แบบเก่า: legacyLogoDb });

/** The warnings above every Owner tab. Controls:
 *  - missingMaterialSettings: materials with no base count / unit price (0 hides it).
 *  - returnReady: closed lots waiting for a truck home (0 hides it); the kg is their total.
 *  - tab: the open tab; each banner hides on the tab its button leads to (config /
 *    return-shipment). Both at 0 renders nothing. */
export const AlertBanners: StoryObj<{
  missingMaterialSettings: number;
  returnReady: number;
  tab: Tab;
}> = {
  argTypes: {
    missingMaterialSettings: { control: { type: "number", min: 0 } },
    returnReady: {
      control: { type: "range", min: 0, max: db.lots.length, step: 1 },
    },
    tab: {
      control: "inline-radio",
      options: ["owner-dashboard", "config", "return-shipment"],
    },
  },
  args: { missingMaterialSettings: 2, returnReady: 1, tab: "owner-dashboard" },
  render: ({ missingMaterialSettings, returnReady, tab }) => (
    <OwnerAlertBanners
      db={db}
      alerts={{
        missingMaterialSettings,
        returnReady: db.lots.slice(0, returnReady),
      }}
      tab={tab}
      onTab={fn()}
    />
  ),
};

/** เลือกสถานะใน Controls:
 *  - ตัวอย่าง: the seven-day demo run; "ยังไม่ผูก" reads all clear.
 *  - ยังไม่ผูก: ศาลาแดง 10 kg in "ไม่ระบุ Lot", 1 material receipt with no transfer, 1 batch
 *    with no smoke PO (Chef House smoked it first), 1 purchase PO with no Foodiva invoice.
 *  - ผูกแล้ว: the same after ศาลาแดง linked its meat to the 35 kg batch: meat reads 0 and
 *    the sale is costed on the batch. */
export const Dashboard: Story = {
  argTypes: { db: linkState.argType },
  args: { db: linkState.initial },
  render: ({ db }) => <OwnerDashboard db={db} date={day} onNavigate={fn()} />,
};

/** Every branch × day from 7 days back to `date`: "ครบแล้ว" or one "ค้างกรอก" row per
 *  missing kind. เลือกใน Controls:
 *  - สถานะ ตัวอย่าง: the seven-day demo run.
 *  - สถานะ ปิดวันได้: ศาลาแดง filled everything on `day`.
 *  - สถานะ งานรอ: ศาลาแดง's `day` is still empty, so it lists what is missing.
 *  - date: `day` or the day after (every row one day older). The branch filter and
 *    "ตั้งแต่" are the table's own state. */
export const DailyStatus: StoryObj<{ db: Database; date: string }> = {
  argTypes: {
    db: dailyState.argType,
    date: { control: "inline-radio", options: [day, nextDay] },
  },
  args: { db: dailyState.initial, date: day },
  // key: the "ตั้งแต่" filter starts from `date`, so a new date remounts it.
  render: ({ db, date }) => <OwnerDailyStatus key={date} db={db} date={date} />,
};

/** One row per item, one column per place (Foodiva, คลัง Owner, each branch); "—" where
 *  that place never holds the item. Hover a branch number for its breakdown. เลือกสถานะใน Controls:
 *  - ตัวอย่าง: the seven-day demo run.
 *  - Waste รอรับ: the Waste row has 6 kg still waiting at Foodiva, 4 kg already in คลัง
 *    Owner, and the บันทึกรับเนื้อ action on the same row.
 *  - จัดสรรแล้ว: smoked beef, what is left at Foodiva to allocate beside the 17.5 kg sent
 *    to ศาลาแดง.
 *  - ไม่ระบุ Lot: a "ไม่ระบุ Lot" row holds ศาลาแดง's 10 kg received with no lot (DASH-06). */
export const Stock: Story = {
  argTypes: { db: stockState.argType },
  args: { db: stockState.initial },
  render: ({ db }) => <OwnerStockView db={db} lots={db.lots} open={open} />,
};

/** Every batch not yet in central stock, each with its button (RET-06). เลือกสถานะใน Controls:
 *  - ตัวอย่าง: the seven-day demo run.
 *  - พร้อมจัดสรร: the batch is in central stock (35 kg), nothing left to receive.
 *  - ไม่มีรถกลับ: a batch with only its smoke PO; it can be received with no truck home
 *    and no Foodiva receipt, the chips say what is missing. Its "PO ซื้อ" cell lists the
 *    two purchase POs it draws on (300 + 200 kg).
 *  - ยังไม่จับคู่ PO ซื้อ (RET-07): a smoke PO saved without purchase PO lines shows the
 *    "ยังไม่จับคู่ PO ซื้อ" badge and chip, its button opens the match dialog (`matchPo`);
 *    below, "เข้าสต๊อกกลางแล้ว · ยังไม่จับคู่ PO ซื้อ" keeps the two batches already in
 *    central: one the same, one with no smoke PO at all ("ยังไม่มี PO รมควัน", its
 *    button opens the smoke PO form on that batch). Nothing blocks receiving. */
export const CentralReceive: Story = {
  argTypes: { db: centralState.argType },
  args: { db: centralState.initial },
  render: ({ db }) => <CentralReceiveView db={db} open={open} />,
};

/** เลือกสถานะใน Controls:
 *  - ตัวอย่าง: the seven-day demo run.
 *  - ยังไม่ผูก: a "ไม่ระบุ Lot" row for ศาลาแดง's unlinked meat (also in the Lot filter),
 *    and a batch holding only Chef House's weigh-in and smoke, its empty steps "—".
 *  - ผูกแล้ว: the bucket is gone; the receive, thaw and sale sit on the batch, with the
 *    "ผูก Lot" moves in the log and central stock 25 kg (RET-04). */
export const MeatMovementLog: Story = {
  argTypes: { db: linkState.argType },
  args: { db: linkState.initial },
  render: ({ db }) => <MeatMovementLogView db={db} />,
};

/** เลือกสถานะใน Controls:
 *  - ตัวอย่าง: the seven-day demo run.
 *  - ยังไม่ผูก: includes a batch with only cmReceive and smoke; expand it: every document
 *    it lacks reads "—", no row is hidden (DASH-05).
 *  - ชุดที่มีแค่รับและรมควัน: that batch alone. */
export const Traceability: Story = {
  argTypes: { db: traceState.argType },
  args: { db: traceState.initial },
  render: ({ db }) => <SimpleTraceabilityView db={db} />,
};

/** "ต้นทุนแยก Lot" lists every batch whatever it holds (DASH-04). `hideSales` is the
 *  Account Manager's view: no sales money or margin. เลือกสถานะใน Controls:
 *  - ตัวอย่าง: the seven-day demo run.
 *  - ยังไม่ผูก: the 35 kg batch has no Chef House invoice, so its smoking cost is the
 *    smoke PO's "(ประมาณการ)" (D8); the batch Chef House smoked first has no central count
 *    and shows "—" per kg; the 3 kg sold from "ไม่ระบุ Lot" is its own row at cost 0 (BR-05).
 *  - ผูกแล้ว: that 3 kg is costed on the batch at its per-kg cost. */
export const ReportView: StoryObj<{ db: Database; hideSales: boolean }> = {
  argTypes: { db: linkState.argType, hideSales: { control: "boolean" } },
  args: { db: linkState.initial, hideSales: false },
  render: ({ db, hideSales }) => <Report db={db} hideSales={hideSales} />,
};

/** เลือกโลโก้ใน Controls:
 *  - ปกติ: the demo config.
 *  - โลโก้แบบเก่า: a logo saved before logos moved to storage is a data URL in config; it
 *    still shows. New uploads go to storage (IndexedDB only in Storybook) and config keeps
 *    the key. */
export const Config: Story = {
  argTypes: { db: logoState.argType },
  args: { db: logoState.initial },
  render: ({ db }) => <ConfigView db={db} />,
};
