import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fireEvent, within } from "storybook/test";
import {
  branchTasksDb,
  day,
  dayClosedDb,
  demoDb,
} from "../../../.storybook/fixtures";
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

/** The workspace opens on today; move it to the fixture day so the story shows data. */
const toFixtureDay: Story["play"] = async ({ canvasElement }) => {
  fireEvent.change(
    within(canvasElement).getAllByLabelText("วันที่ทำรายการ")[0],
    { target: { value: day } },
  );
};

export const Day: Story = { parameters: at("day") };
/** ศาลาแดง's `day` after ปิดวัน: the locked notice, and every day form disabled. */
export const DayClosed: Story = {
  parameters: { ...at("day"), db: dayClosedDb },
  play: toFixtureDay,
};

/** ยืนยันรับวัสดุ: 60 units of the first material sent by the Owner, still unconfirmed. */
export const MaterialReceive: Story = {
  parameters: { ...at("material-receive"), db: branchTasksDb },
};

/** ตรวจนับสต๊อกวัสดุวันนี้ on a day the roleplay already counted. */
export const MaterialCount: Story = {
  parameters: at("material-count"),
  play: toFixtureDay,
};

/** ตรวจนับสต๊อกวัสดุวันนี้ on a day still waiting to be counted — the CountPill's case. */
export const MaterialCountPending: Story = {
  parameters: { ...at("material-count"), db: branchTasksDb },
};

/** ข้าวเหนียววันนี้: ซื้อข้าวสุก / เบิกข้าวสาร / นึ่ง / ยกไปวันถัดไป on the roleplay day. */
export const Rice: Story = {
  parameters: at("rice"),
  play: toFixtureDay,
};

/** สต๊อก grouped like the Owner's: สต๊อกเนื้อ, น้ำพริกและของใช้, วัสดุ. */
export const Stock: Story = { parameters: at("stock"), play: toFixtureDay };
export const Summary: Story = { parameters: at("branch-summary") };
export const History: Story = { parameters: at("history") };
export const MinburiDay: Story = {
  parameters: at("day"),
  render: () => <BranchWorkspace account={accountById("minburi")!} />,
};

/** ศาลาแดง's bell: meat allocated but not received, material waiting to be confirmed and
 *  the day still short of what closing needs. Every line opens กรอกรายวัน. */
export const Notifications: Story = {
  parameters: { ...at("day"), db: branchTasksDb },
  play: async ({ canvasElement }) => {
    fireEvent.click(
      within(canvasElement).getByLabelText(/^การแจ้งเตือน/, {
        selector: "button",
      }),
    );
  },
};

/** The same database seen by มีนบุรี: none of ศาลาแดง's work reaches this branch's bell. */
export const MinburiNotifications: Story = {
  parameters: { ...at("day"), db: branchTasksDb },
  render: () => <BranchWorkspace account={accountById("minburi")!} />,
  play: Notifications.play,
};
