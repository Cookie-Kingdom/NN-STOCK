import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { FormGrid } from "@/components/molecules/FormGrid";
import type { Field as FieldSpec } from "@/lib/forms";
import type { PrefillSource } from "@/lib/prefill";
import type { Values } from "@/lib/store";
import { EntryFieldControl } from "./EntryForm";

const meta: Meta = {
  title: "Organisms/Shared/EntryFieldControl",
};

export default meta;

const types = [
  "text",
  "number",
  "tel",
  "date",
  "time",
  "textarea",
  "select",
  "location",
  "file",
  "files",
] as const;
type Type = (typeof types)[number];

const prefills: Record<string, PrefillSource | undefined> = {
  ไม่มี: undefined,
  จากประวัติ: { label: "จาก PO-0412 (09/09)" },
  ค่าคาดการณ์: { label: "จาก PO", expected: true },
};

type Args = {
  type: Type;
  label: string;
  optional: boolean;
  hint: string;
  value: string;
  prefilled: PrefillSource | undefined;
};

/** A field as `forms[kind]` would list it, with options for the two select types. */
const spec = (
  type: Type,
  label: string,
  optional = false,
  hint = "",
): FieldSpec => ({
  key: type,
  label,
  type,
  optional,
  hint: hint || undefined,
  options:
    type === "location"
      ? ["เชียงใหม่", "กรุงเทพฯ", "อื่น ๆ"]
      : type === "select"
        ? ["ศาลาแดง", "มีนบุรี"]
        : undefined,
  accept: type === "file" || type === "files" ? "image/*,.pdf" : undefined,
});

/** One control with its own values, so typing and picking work in the canvas. */
function Control({
  field,
  value = "",
  prefilled,
}: {
  field: FieldSpec;
  value?: string;
  prefilled?: PrefillSource;
}) {
  const [values, setValues] = useState<Values>({ [field.key]: value });
  const [files, setFiles] = useState<File[]>([]);
  const [changed, setChanged] = useState(false);
  return (
    <EntryFieldControl
      field={field}
      autoFocus={false}
      values={values}
      // Like the form: the prefill caption goes once the user changes the value.
      source={changed ? undefined : prefilled}
      set={(key, next) => {
        setChanged(true);
        setValues((current) => ({ ...current, [key]: next }));
      }}
      onFile={(key, file) =>
        setValues((v) => ({ ...v, [key]: file?.name ?? "" }))
      }
      files={files}
      onFiles={(_key, picked) => setFiles(picked)}
      onFileError={fn().mockName("onFileError")}
    />
  );
}

/** One field of an EntryForm, rendered by its `type`. Controls: the type, label,
 *  optional mark, hint, a starting value and the prefill caption (from history, or an
 *  expected value to weigh/count). `location` "อื่น ๆ" opens a free-text box; file
 *  types ignore the value and the caption. */
export const Field: StoryObj<Args> = {
  argTypes: {
    type: { control: "select", options: types },
    label: { control: "text" },
    optional: { control: "boolean" },
    hint: { control: "text" },
    value: { control: "text" },
    prefilled: {
      name: "ค่าที่เติมให้",
      options: Object.keys(prefills),
      mapping: prefills,
      control: "radio",
    },
  },
  args: {
    type: "number",
    label: "น้ำหนัก (กก.)",
    optional: false,
    hint: "",
    value: "",
    prefilled: "ไม่มี" as unknown as undefined,
  },
  render: ({ type, label, optional, hint, value, prefilled }) => (
    <FormGrid className="max-w-3xl p-6">
      <Control
        key={`${type}:${value}:${prefilled?.label}`}
        field={spec(type, label, optional, hint)}
        value={value}
        prefilled={prefilled}
      />
    </FormGrid>
  ),
};

/** Every field type side by side, as they sit in a form grid. */
export const AllTypes: StoryObj = {
  render: () => (
    <FormGrid className="max-w-3xl p-6">
      {types.map((type) => (
        <Control key={type} field={spec(type, `ช่องแบบ ${type}`)} />
      ))}
    </FormGrid>
  ),
};
