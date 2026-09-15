import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { centralDb, day, demoDb, open } from "../../../../.storybook/fixtures";
import { CentralReceiveView } from "./CentralReceiveView";
import { ConfigView } from "./ConfigView";
import { MeatMovementLogView } from "./MeatMovementLogView";
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

export const Dashboard: Story = {
  render: () => <OwnerDashboard db={db} date={day} onNavigate={fn()} />,
};

export const DailyStatus: Story = {
  render: () => <OwnerDailyStatus db={db} date={day} />,
};

export const Stock: Story = {
  render: () => <OwnerStockView db={db} lots={db.lots} open={open} />,
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
