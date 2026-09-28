import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  acceptedInvoiceDb,
  allocatedDb,
  centralDb,
  day,
  demoDb,
  freeOrderDb,
  open,
  ownerReservedDb,
  paidDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import type { Database } from "@/lib/store";
import { CentralReceiveView } from "./CentralReceiveView";
import { InvoiceView } from "./InvoiceView";
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
  จัดสรรแล้ว: allocatedDb,
});
const centralState = pick("สถานะ", {
  ตัวอย่าง: db,
  พร้อมจัดสรร: centralDb,
  ไม่มีรถกลับ: freeOrderDb,
});
const logoState = pick("โลโก้", { ปกติ: db, โลโก้แบบเก่า: legacyLogoDb });
const invoiceState = pick("สถานะ", {
  รอชำระ: acceptedInvoiceDb,
  ชำระแล้ว: paidDb,
  "ยังไม่มี Invoice": freeOrderDb,
});

/** Both banners at once; in the app each hides on the tab its button leads to. */
export const AlertBanners: Story = {
  render: () => (
    <OwnerAlertBanners
      db={db}
      alerts={{ missingMaterialSettings: 2, returnReady: db.lots.slice(0, 2) }}
      tab="owner-dashboard"
      onTab={fn()}
    />
  ),
};

export const Dashboard: Story = {
  render: () => <OwnerDashboard db={db} date={day} onNavigate={fn()} />,
};

export const DailyStatus: Story = {
  render: () => <OwnerDailyStatus db={db} date={day} />,
};

/** One row per item, one column per place (Foodiva, คลัง Owner, each branch); "—" where
 *  that place never holds the item. Hover a branch number for its breakdown. เลือกสถานะใน Controls:
 *  - ตัวอย่าง: the seven-day demo run.
 *  - Waste รอรับ: the Waste row has 6 kg still waiting at Foodiva, 4 kg already in คลัง
 *    Owner, and the บันทึกรับเนื้อ action on the same row.
 *  - จัดสรรแล้ว: smoked beef, what is left at Foodiva to allocate beside the 17.5 kg sent
 *    to ศาลาแดง. */
export const Stock: Story = {
  argTypes: { db: stockState.argType },
  args: { db: stockState.initial },
  render: ({ db }) => <OwnerStockView db={db} lots={db.lots} open={open} />,
};

/** Every batch not yet in central stock, each with its button (RET-06). เลือกสถานะใน Controls:
 *  - ตัวอย่าง: the seven-day demo run.
 *  - พร้อมจัดสรร: the batch is in central stock (35 kg), nothing left to receive.
 *  - ไม่มีรถกลับ: a batch with only its smoke PO; it can be received with no truck home
 *    and no Foodiva receipt, the chips say what is missing. */
export const CentralReceive: Story = {
  argTypes: { db: centralState.argType },
  args: { db: centralState.initial },
  render: ({ db }) => <CentralReceiveView db={db} open={open} />,
};

export const MeatMovementLog: Story = {
  render: () => <MeatMovementLogView db={db} />,
};

export const Traceability: Story = {
  render: () => <SimpleTraceabilityView db={db} />,
};

export const ReportView: Story = { render: () => <Report db={db} /> };

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

/** Foodiva and Chef House invoices. เลือกสถานะใน Controls:
 *  - รอชำระ: both waiting to be paid, "ชำระเงิน" on each.
 *  - ชำระแล้ว: both paid, the สลิป column lists each slip with view and download.
 *  - ยังไม่มี Invoice: POs and a batch with no invoice yet still get "ชำระเงิน". */
export const Invoices: Story = {
  argTypes: { db: invoiceState.argType },
  args: { db: invoiceState.initial },
  render: ({ db }) => <InvoiceView db={db} open={open} />,
};
