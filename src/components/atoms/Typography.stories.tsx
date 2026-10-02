import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Caption, Footnote, Muted } from "./Text";

const meta = { title: "Atoms/Typography" } satisfies Meta;

export default meta;

/** Bare h1–h3 get their sizes from globals.css. */
export const Scale: StoryObj = {
  render: () => (
    <div className="grid gap-2">
      <h1>หัวข้อ H1 · Daily Log</h1>
      <h2>หัวข้อ H2 · SH-2026-0001</h2>
      <h3>หัวข้อ H3 · จ่ายเงินล่าสุด</h3>
      <p>ข้อความปกติ 1,234.50 กก.</p>
      <Muted>Muted: ข้อความรอง</Muted>
      <Caption>Caption: บรรทัดเล็กใต้ช่องกรอกหรือในช่องตาราง</Caption>
      <Footnote>Footnote: หมายเหตุท้ายตาราง</Footnote>
    </div>
  ),
};
