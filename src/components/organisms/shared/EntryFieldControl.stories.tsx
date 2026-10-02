import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FormGrid } from "@/components/molecules/FormGrid";
import { accountById } from "@/lib/accounts";
import { defaults, fields } from "@/lib/forms";
import { noteKinds, type NoteKind, type Values } from "@/lib/store";
import { demoDb } from "../../../../.storybook/fixtures";
import { EntryFieldControl } from "./EntryFieldControl";

/** Every control of one kind's form, as the Owner gets it. */
function Fields({ kind }: { kind: NoteKind }) {
  const [values, setValues] = useState<Values>(defaults(kind));
  return (
    <FormGrid className="grid-cols-[repeat(auto-fill,minmax(180px,1fr))] items-start gap-4">
      {fields(kind, demoDb, accountById("owner")!)
        .filter((f) => !f.when || f.when(values))
        .map((f) => (
          <EntryFieldControl
            key={f.key}
            field={f}
            values={values}
            set={(key, value) => setValues({ ...values, [key]: value })}
            onFile={(key, file) =>
              setValues({ ...values, [key]: file?.name ?? "" })
            }
            onFileError={() => {}}
          />
        ))}
    </FormGrid>
  );
}

const meta = {
  title: "Organisms/Shared/EntryFieldControl",
  component: Fields,
  tags: ["!autodocs"],
  args: { kind: "pay" },
  argTypes: { kind: { control: "select", options: noteKinds } },
  render: ({ kind }) => <Fields key={kind} kind={kind} />,
} satisfies Meta<typeof Fields>;

export default meta;
type Story = StoryObj<typeof meta>;

/** เลือก `kind` ใน Controls เพื่อดูช่องของบันทึกแต่ละชนิด:
 *  - ช่องหลักที่ยังว่างเป็นสีเหลือง พิมพ์แล้วกลับเป็นสีปกติ
 *  - จ่ายเงิน: เลือกหมวด แพ็กเกจ/วัสดุ หรือ วัตถุดิบ แล้วมีช่อง รายการที่ซื้อ จำนวน และสาขา; เลือก ค่าแรง แล้วมีช่องชื่อพนักงาน
 *  - ผู้ขาย และ ผู้จ่าย มีรายการให้เลือกจากที่เคยพิมพ์ */
export const Default: Story = {};

/** ยอดขาย: หนึ่งช่องยอดขายต่อช่องทางขายใน Settings */
export const Sale: Story = { args: { kind: "sale" } };
