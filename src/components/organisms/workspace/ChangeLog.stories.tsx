import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { AccountId } from "@/lib/accounts";
import { ChangeLog } from "./ChangeLog";
import { WithWorkspace, changedDb, sampleDb } from "./storyWorkspace";

const Log = ({ account }: { account: AccountId }) => (
  <WithWorkspace account={account}>
    {(ws) => <ChangeLog ws={ws} />}
  </WithWorkspace>
);

const meta = {
  title: "Organisms/Workspace/ChangeLog",
  component: Log,
  args: { account: "owner" },
  argTypes: { account: { control: false } },
  parameters: { db: changedDb },
} satisfies Meta<typeof Log>;

export default meta;
type Story = StoryObj<typeof meta>;

/** การแก้ไขบอกค่าก่อน → หลัง · การลบกด「ย้อนกลับ」เพื่อกู้คืน · รายการที่ย้อนกลับแล้วมีป้ายบอก
 *  และการกู้คืนเองย้อนกลับไม่ได้ (แก้ไขหรือลบใหม่แทน) */
export const Default: Story = {};

/** ยังไม่มีการแก้ไขหรือลบ */
export const Empty: Story = { parameters: { db: sampleDb } };
