import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fireEvent, within } from "storybook/test";
import { day, dayClosedDb, demoDb } from "../../../.storybook/fixtures";
import { accountById } from "@/lib/accounts";
import type { Tab } from "@/lib/nav";
import { BranchWorkspace } from "./BranchWorkspace";

// See OwnerWorkspace.stories.tsx for why each story sets the URL segment.
const at = (tab: Tab) => ({ nextjs: { navigation: { segments: [tab] } } });

const meta: Meta = {
  title: "Pages/Branch",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen", db: demoDb },
  render: () => <BranchWorkspace account={accountById("saladaeng")!} />,
};

export default meta;
type Story = StoryObj;

export const Day: Story = { parameters: at("day") };
/** ศาลาแดง's `day` after ปิดวัน: the locked notice, and every day form disabled. */
export const DayClosed: Story = {
  parameters: { ...at("day"), db: dayClosedDb },
  play: async ({ canvasElement }) => {
    // The workspace opens on today; move it to the closed fixture day.
    fireEvent.change(
      within(canvasElement).getAllByLabelText("วันที่ทำรายการ")[0],
      { target: { value: day } },
    );
  },
};
export const Stock: Story = { parameters: at("stock") };
export const Summary: Story = { parameters: at("branch-summary") };
export const History: Story = { parameters: at("history") };
export const MinburiDay: Story = {
  parameters: at("day"),
  render: () => <BranchWorkspace account={accountById("minburi")!} />,
};
