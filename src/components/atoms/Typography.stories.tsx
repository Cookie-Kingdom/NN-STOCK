import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Overline } from "./Overline";
import { Caption, Footnote, Muted } from "./Text";

const meta = {
  title: "Atoms/Typography",
  component: Overline,
  args: { children: "สต๊อกกลาง" },
  argTypes: {
    tone: { control: "inline-radio", options: ["default", "accent"] },
  },
} satisfies Meta<typeof Overline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OverlineDefault: Story = {};
export const OverlineAccent: Story = { args: { tone: "accent" } };

/** Bare h1–h3 get their sizes from globals.css. */
export const Scale: Story = {
  render: () => (
    <div className="grid gap-2">
      <Overline>Overline</Overline>
      <h1>หัวข้อ H1 · ระบบสต๊อก</h1>
      <h2>หัวข้อ H2 · รับเนื้อเข้า</h2>
      <h3>หัวข้อ H3 · รายการล็อต</h3>
      <p>ข้อความปกติ (body) 1,234.50 กก.</p>
      <Muted>Muted — ข้อความรอง</Muted>
      <Caption>Caption — บรรทัดเล็กใต้ฟิลด์หรือในช่องตาราง</Caption>
      <Footnote>Footnote — หมายเหตุท้ายตาราง</Footnote>
    </div>
  ),
};
