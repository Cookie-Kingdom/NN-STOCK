import { useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { pick } from "../../../.storybook/pick";
import { FileUploadField } from "./FileUploadField";

const meta = {
  title: "Molecules/FileUploadField",
  component: FileUploadField,
  args: {
    label: "ใบส่งของ",
    accept: "image/*,application/pdf",
    onFile: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FileUploadField>;

export default meta;
type Story = StoryObj<typeof meta>;

type Props = ComponentProps<typeof FileUploadField>;

const state = pick<Partial<Props>>("สถานะ", {
  ยังไม่เลือก: {},
  เลือกไฟล์แล้ว: {
    optional: true,
    fileName: "invoice-PO-2026-0001.pdf",
    hint: "แนบ Invoice ของร้านขายเนื้อ เติมทีหลังได้",
  },
  จำกัดขนาด: {
    label: "รูปเนื้อรมควันก่อนส่ง",
    maxBytes: 2 * 1024 * 1024,
    oversizeMessage: "รูปใหญ่เกิน 2 MB กรุณาเลือกรูปที่เล็กกว่านี้",
    hint: "รองรับ JPG หรือ PNG ไม่เกิน 2 MB",
  },
});

const preview = pick("preview", {
  ไม่มี: undefined,
  รูปตัวอย่าง: (
    <div className="mt-2 grid size-16 place-items-center rounded-md bg-accent/15 text-caption text-accent">
      LOGO
    </div>
  ),
});

/** Pick the state in Controls:
 *  - ยังไม่เลือก: the dashed box holds just the picker
 *  - เลือกไฟล์แล้ว: `fileName` prints "เลือกแล้ว: …" under the picker; `hint` sits
 *    below the box
 *  - จำกัดขนาด: `maxBytes` rejects an oversize file — the input is cleared, `onFile`
 *    is not called and the message shows inside the box. Pick a file over 2 MB to
 *    see it.
 *  - `preview`: rendered inside the box under the picker, e.g. the current logo */
export const Default: StoryObj<Props & { state: Partial<Props> }> = {
  argTypes: {
    state: state.argType,
    preview: preview.argType,
  },
  args: {
    state: state.initial,
    preview: preview.initial,
  },
  render: ({ state, ...args }) => <FileUploadField {...args} {...state} />,
};

function LogoUpload() {
  const [name, setName] = useState("");
  return (
    <FileUploadField
      label="โลโก้ร้าน"
      accept="image/*"
      maxBytes={1024 * 1024}
      fileName={name}
      hint="ใช้บนหัวเอกสาร"
      onFile={(file) => setName(file?.name ?? "")}
    />
  );
}

/** `onFile` hands the File back; the caller keeps the name and any preview. */
export const Interactive: Story = { render: () => <LogoUpload /> };
