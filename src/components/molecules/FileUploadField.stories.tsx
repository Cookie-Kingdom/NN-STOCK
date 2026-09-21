import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
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

/** Nothing chosen yet: the dashed box holds just the picker. */
export const Empty: Story = {};

/** `fileName` prints "เลือกแล้ว: …" under the picker; `hint` sits below the box. */
export const FileChosen: Story = {
  args: {
    optional: true,
    fileName: "ใบส่งของ-LOT-0915-01.pdf",
    hint: "แนบใบส่งของของ Foodiva เพื่อให้เจ้าของตรวจสอบภายหลัง",
  },
};

/**
 * `maxBytes` rejects an oversize file: the input is cleared, `onFile` is not
 * called and the message shows inside the box. Pick a file over 2 MB to see it.
 */
export const SizeLimited: Story = {
  args: {
    label: "รูปเนื้อรมควันก่อนส่ง",
    maxBytes: 2 * 1024 * 1024,
    oversizeMessage: "รูปต้องมีขนาดไม่เกิน 2 MB",
    hint: "รองรับ JPG หรือ PNG ไม่เกิน 2 MB",
  },
};

function LogoUpload() {
  const [name, setName] = useState("");
  return (
    <FileUploadField
      label="โลโก้ร้าน"
      accept="image/*"
      maxBytes={1024 * 1024}
      fileName={name}
      hint="ใช้บนหัวใบส่งของและ PO"
      onFile={(file) => setName(file?.name ?? "")}
    />
  );
}

/** `onFile` hands the File back; the caller keeps the name and any preview. */
export const Interactive: Story = { render: () => <LogoUpload /> };

function SlipUpload() {
  const [names, setNames] = useState<string[]>([]);
  return (
    <FileUploadField
      label="แนบสลิปการชำระ"
      optional
      multiple
      accept=".pdf,image/*"
      maxBytes={2 * 1024 * 1024}
      fileName={names.join("\n")}
      hint="เลือกได้หลายไฟล์พร้อมกัน"
      onFiles={(files) => setNames(files.map((file) => file.name))}
    />
  );
}

/** `multiple` + `onFiles`: several slips at once, one name per line. */
export const MultipleFiles: Story = {
  args: {
    label: "แนบสลิปการชำระ",
    optional: true,
    multiple: true,
    fileName: "slip-2026-09-20.jpg\nslip-2026-09-20-2.pdf",
  },
};

/** Pick several files; every name is listed. */
export const MultipleInteractive: Story = { render: () => <SlipUpload /> };
