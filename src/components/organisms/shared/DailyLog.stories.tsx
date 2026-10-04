import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  WithWorkspace,
  changedDb,
  dbFor,
  phone,
  wide,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import type { AccountId } from "@/lib/accounts";
import { DailyLog } from "./DailyLog";

const Log = ({ account }: { account: AccountId }) => (
  <WithWorkspace account={account}>
    {(ws) => <DailyLog ws={ws} />}
  </WithWorkspace>
);

const meta = {
  title: "Organisms/Shared/DailyLog",
  component: Log,
  args: { account: "owner" },
  argTypes: { account: { control: false } },
  parameters: { db: sampleDb },
} satisfies Meta<typeof Log>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner: ป้ายยอดขายของสองสาขาที่หัววัน วันที่มีสาขายังไม่ได้จดยอดขายเป็นสีเหลือง
 *  และกดป้ายเหลืองเพื่อจดยอดขายของสาขาและวันนั้น · ตัวกรอง ทั้งหมด / ยังไม่ได้จด / Lot / เงิน / สาขา */
export const Owner: Story = {};

/** Account Manager: ไม่มีป้ายยอดขาย ไม่มีวันสีเหลือง ไม่มีแถวยอดขายและค่าแรง */
export const Manager: Story = {
  args: { account: "manager" },
  parameters: { db: dbFor("manager") },
};

/** สาขา: ป้ายของสาขาตัวเอง ตัวกรองเหลือสองตัว และกล่องเนื้อคงเหลือ */
export const Branch: Story = {
  args: { account: "saladaeng" },
  parameters: { db: dbFor("saladaeng") },
};

/** มีการแก้ไขและลบ: ประวัติด้านล่างบอกค่าก่อนและหลัง กด「ย้อนกลับ」ได้ */
export const WithChanges: Story = { parameters: { db: changedDb } };

/** จอ 390px: คอลัมน์เดียว กล่องยังไม่ได้จดอยู่ใต้รายการ */
export const Phone: Story = { ...phone };

/** จอ 1920px: ประวัติการแก้ไขเป็นคอลัมน์ที่สาม */
export const Wide: Story = {
  ...wide,
  parameters: { ...wide.parameters, db: changedDb },
};
