import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { accountById } from "@/lib/accounts";
import {
  MockSavedAccounts,
  MockSession,
  type SavedAccount,
} from "../../../.storybook/mocks/session";
import { SavedAccounts } from "./SavedAccounts";

const saved: SavedAccount[] = [
  { id: "owner", name: "Owner" },
  { id: "saladaeng", name: "สาขาศาลาแดง" },
  { id: "minburi", name: "สาขามีนบุรี" },
];

const meta = {
  title: "Molecules/SavedAccounts",
  component: SavedAccounts,
  decorators: [
    (Story) => (
      <MockSavedAccounts value={saved}>
        <div className="max-w-80">
          <Story />
        </div>
      </MockSavedAccounts>
    ),
  ],
} satisfies Meta<typeof SavedAccounts>;

export default meta;
type Story = StoryObj<typeof meta>;

/** เข้าสู่ระบบเป็น Owner อยู่: แถวของ Owner มีป้าย "ใช้งานอยู่" และกดไม่ได้ · กดแถวอื่นเพื่อสลับไปบัญชีนั้นโดยไม่ต้องใส่รหัสผ่าน (`switchAccount` และ `router.replace` ใน Actions) */
export const Default: Story = {};

/** ยังไม่ได้เข้าสู่ระบบ (หน้าเข้าสู่ระบบ): ทุกแถวกดได้ มีหัวข้อเหนือรายการ */
export const SignedOut: Story = {
  args: {
    heading: (
      <h2 className="m-0 text-caption font-medium text-text-secondary">
        บัญชีที่บันทึกไว้
      </h2>
    ),
  },
  decorators: [
    (Story) => (
      <MockSession value={{ ready: true, account: null, error: "" }}>
        <Story />
      </MockSession>
    ),
  ],
};

/** บัญชีเดียว และเป็นบัญชีที่เปิดอยู่ */
export const OnlyCurrent: Story = {
  decorators: [
    (Story) => (
      <MockSavedAccounts value={[{ id: "owner", name: "Owner" }]}>
        <MockSession
          value={{ ready: true, account: accountById("owner"), error: "" }}
        >
          <Story />
        </MockSession>
      </MockSavedAccounts>
    ),
  ],
};
