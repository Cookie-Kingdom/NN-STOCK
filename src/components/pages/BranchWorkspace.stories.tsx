import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useSelectedLayoutSegment } from "@storybook/nextjs-vite/navigation.mock";
import { fireEvent, within } from "storybook/test";
import {
  branchTasksDb,
  day,
  dayClosedDb,
  demoDb,
} from "../../../.storybook/fixtures";
import { pick } from "../../../.storybook/pick";
import { accountById } from "@/lib/accounts";
import { branchNav, type Tab } from "@/lib/nav";
import type { Database } from "@/lib/store";
import { BranchWorkspace } from "./BranchWorkspace";

type Args = { db: Database; account: "saladaeng" | "minburi"; tab: Tab };

const navItems = branchNav.flatMap((group) => group.items);
const dataState = pick("ข้อมูล", {
  เปิดวัน: demoDb,
  ปิดวันแล้ว: dayClosedDb,
  ยังไม่ได้จด: branchTasksDb,
});

const meta: Meta<Args> = {
  title: "Pages/Branch",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
  argTypes: {
    tab: {
      name: "แท็บ",
      options: navItems.map((item) => item.id),
      control: {
        type: "select",
        labels: Object.fromEntries(navItems.map((i) => [i.id, i.label])),
      },
    },
    account: {
      name: "สาขา",
      options: ["saladaeng", "minburi"],
      control: {
        type: "radio",
        labels: { saladaeng: "ศาลาแดง", minburi: "มีนบุรี" },
      },
    },
    db: dataState.argType,
  },
  args: { tab: "day", account: "saladaeng", db: dataState.initial },
  render: ({ account, tab }) => {
    // The workspace reads its tab from the URL segment; the mocked hook turns it into a control.
    useSelectedLayoutSegment.mockReturnValue(tab);
    return <BranchWorkspace account={accountById(account)!} />;
  },
};

export default meta;
type Story = StoryObj<Args>;

/** Every tab of the branch workspace, moved to the fixture day (it opens on today).
 *  Controls:
 *  - แท็บ: จดรายวัน (5 steps; step 3 leads to ข้าวเหนียววันนี้), รับวัสดุ,
 *    ตรวจนับสต๊อกวัสดุวันนี้, ข้าวเหนียววันนี้, สต๊อก (one table like the Owner's, this
 *    branch only), สรุปคงเหลือเนื้อ, สรุปสาขา, ประวัติ.
 *  - ข้อมูล: เปิดวัน; ปิดวันแล้ว (locked notice, every day form disabled); ยังไม่ได้จด
 *    (nothing received, materials not yet counted).
 *  - สาขา: ศาลาแดง or มีนบุรี (buys cooked rice only). */
export const Workspace: Story = {
  play: async ({ canvasElement }) => {
    fireEvent.change(
      within(canvasElement).getAllByLabelText("วันที่ทำรายการ")[0],
      { target: { value: day } },
    );
  },
};

/** The bell opened on ยังไม่ได้จด. Pick สาขา in Controls:
 *  - ศาลาแดง: the day still short of what closing needs (opens จดรายวัน) and the
 *    materials not counted yet (opens ตรวจนับสต๊อกวัสดุวันนี้). Nothing waits on the Owner.
 *  - มีนบุรี: the same database, its own day and count; nothing of ศาลาแดง's reaches it. */
export const Notifications: Story = {
  // ponytail: the pick's label; Storybook maps it to branchTasksDb.
  args: { db: "ยังไม่ได้จด" as unknown as Database },
  play: async ({ canvasElement }) => {
    fireEvent.click(
      within(canvasElement).getByLabelText(/^การแจ้งเตือน/, {
        selector: "button",
      }),
    );
  },
};
