import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { pick } from "../../../.storybook/pick";
import { AttachmentButton, SlipList } from "./AttachmentButton";

const meta = {
  title: "Molecules/AttachmentButton",
  component: AttachmentButton,
  args: { action: "download" },
  argTypes: {
    action: { control: "inline-radio", options: ["download", "view"] },
    label: { control: "text" },
  },
} satisfies Meta<typeof AttachmentButton>;

export default meta;
type Props = ComponentProps<typeof AttachmentButton>;

const file = pick<Partial<Props>>("ไฟล์", {
  ไฟล์ในเครื่อง: {
    name: "INV-DEMO-002.txt",
    data: "data:text/plain;base64,SW52b2ljZQ==",
  },
  "PDF ในเครื่อง": {
    name: "INV-DEMO-004.pdf",
    data: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0YK",
  },
  มีแต่ชื่อไฟล์: { name: "INV-DEMO-001.pdf" },
  ไม่พบในที่เก็บ: { name: "INV-DEMO-003.pdf", storageKey: "missing" },
  ไม่มีไฟล์: { name: "" },
});

/** Pick `action` and the file in Controls:
 *  - ไฟล์ในเครื่อง: an inline `data:` file — download saves it; view saves it too
 *    (a .txt is not a viewable type)
 *  - PDF ในเครื่อง: a viewable type — view opens it in a new tab
 *  - มีแต่ชื่อไฟล์: the upload never reached the bucket — the click reports it inline
 *  - ไม่พบในที่เก็บ: a key that exists in no browser and no bucket — reported inline
 *  - ไม่มีไฟล์: download shows "ยังไม่มีไฟล์แนบ"; view still renders a button */
export const Default: StoryObj<Props & { file: Partial<Props> }> = {
  argTypes: { file: file.argType },
  args: { file: file.initial },
  render: ({ file, ...args }) => <AttachmentButton {...args} {...file} />,
};

const slips = pick<string | undefined>("สลิป", {
  สองไฟล์: JSON.stringify([
    { name: "สลิปโอนเงิน.jpg", storageKey: "missing-1" },
    { name: "สลิปงวด 2.pdf", storageKey: "missing-2" },
  ]),
  ไม่มีสลิป: undefined,
});

/** `SlipList`, pick in Controls: สองไฟล์ = a view + download pair per uploaded file;
 *  ไม่มีสลิป = "ไม่มีสลิป". */
export const Slips: StoryObj<{ value?: string }> = {
  argTypes: { value: slips.argType },
  args: { value: slips.initial },
  render: ({ value }) => <SlipList value={value} />,
};
