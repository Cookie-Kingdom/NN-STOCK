import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  acceptedInvoiceDb,
  allocatedDb,
  centralDb,
  day,
  demoDb,
  open,
  ownerReservedDb,
  paidDb,
} from "../../../../.storybook/fixtures";
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
type Story = StoryObj;

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
 *  that place never holds the item. Hover a branch number for its breakdown. */
export const Stock: Story = {
  render: () => <OwnerStockView db={db} lots={db.lots} open={open} />,
};

/** The Waste row: 6 kg still waiting at Foodiva, 4 kg already in คลัง Owner, and the
 *  บันทึกรับเนื้อ action on the same row. */
export const StockWasteWaiting: Story = {
  parameters: { db: ownerReservedDb },
  render: () => (
    <OwnerStockView
      db={ownerReservedDb}
      lots={ownerReservedDb.lots}
      open={open}
    />
  ),
};

/** Smoked beef: what is left at Foodiva to allocate beside the 17.5 kg sent to ศาลาแดง. */
export const StockAllocated: Story = {
  parameters: { db: allocatedDb },
  render: () => (
    <OwnerStockView db={allocatedDb} lots={allocatedDb.lots} open={open} />
  ),
};

export const CentralReceive: Story = {
  render: () => <CentralReceiveView db={db} open={open} />,
};

export const CentralReceiveReady: Story = {
  parameters: { db: centralDb },
  render: () => <CentralReceiveView db={centralDb} open={open} />,
};

export const MeatMovementLog: Story = {
  render: () => <MeatMovementLogView db={db} />,
};

export const Traceability: Story = {
  render: () => <SimpleTraceabilityView db={db} />,
};

export const ReportView: Story = { render: () => <Report db={db} /> };

export const Config: Story = { render: () => <ConfigView db={db} /> };

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
export const ConfigLegacyLogo: Story = {
  parameters: { db: legacyLogoDb },
  render: () => <ConfigView db={legacyLogoDb} />,
};

/** Both Foodiva and Chef House invoices waiting to be paid: "ชำระเงิน" on each. */
export const Invoices: Story = {
  parameters: { db: acceptedInvoiceDb },
  render: () => <InvoiceView db={acceptedInvoiceDb} open={open} />,
};

/** Both paid: the สลิป column lists each slip with view and download. */
export const InvoicesPaid: Story = {
  parameters: { db: paidDb },
  render: () => <InvoiceView db={paidDb} open={open} />,
};
