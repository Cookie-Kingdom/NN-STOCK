import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "storybook/test";
import { open } from "../../../../.storybook/fixtures";
import { accountById, type AccountId } from "@/lib/accounts";
import { QuickAdd } from "./QuickAdd";

// The chooser is a native modal <dialog>; a Docs page would stack them.
const meta: Meta = {
  title: "Organisms/Workspace/QuickAdd",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj<{ account: AccountId; disabled: boolean }>;

const onTab = fn().mockName("onTab");

/** 「จดบันทึก」 in the header, opened. Pick บัญชี in Controls:
 *  - Owner / Account Manager: every note the Owner records, the partners' ones included,
 *    under ซื้อ · ผลิต · ขนส่ง / รับเข้า · เงิน · สต๊อก / วัตถุดิบ · ประจำวัน. The manager
 *    gets the same list: none of these forms asks for sale money.
 *  - ศาลาแดง: the branch's own notes under ซื้อ · รับเข้า · สต๊อก / วัตถุดิบ ·
 *    ขาย / ประจำวัน.
 *  Focus starts on the first note; a pick logs `open(kind, "")` in Actions, and the two
 *  recorded on a screen of their own (เช็ควัสดุ, รับวัสดุ) log `onTab` instead.
 *  ปิดใช้งาน: the button while the server payload is still loading. */
export const Chooser: Story = {
  argTypes: {
    account: {
      name: "บัญชี",
      options: ["owner", "manager", "saladaeng"],
      control: {
        type: "radio",
        labels: {
          owner: "Owner",
          manager: "Account Manager",
          saladaeng: "ศาลาแดง",
        },
      },
    },
    disabled: { name: "ปิดใช้งาน", control: "boolean" },
  },
  args: { account: "owner", disabled: false },
  render: ({ account, disabled }) => (
    <div className="flex justify-end p-6">
      <QuickAdd
        // key: a new account starts with the chooser closed, and `play` opens it.
        key={account}
        account={accountById(account)!}
        disabled={disabled}
        onOpen={open}
        onTab={onTab}
      />
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    if (args.disabled) return;
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "จดบันทึก" }),
    );
  },
};

/** One column on a phone: every note is a full-width, 44px button. */
export const ChooserMobile: Story = {
  ...Chooser,
  args: { account: "saladaeng", disabled: false },
  globals: { viewport: { value: "mobile2", isRotated: false } },
};
