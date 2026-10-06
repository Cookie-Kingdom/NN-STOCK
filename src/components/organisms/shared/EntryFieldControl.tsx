"use client";

import { Combobox } from "@/components/atoms/Combobox";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Caption } from "@/components/atoms/Text";
import { Textarea } from "@/components/atoms/Textarea";
import { FileUploadField } from "@/components/molecules/FileUploadField";
import { FormField } from "@/components/molecules/FormField";
import { timeOptions, type Field } from "@/lib/forms";
import type { Values } from "@/lib/store";
import { cn } from "@/lib/utils";

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

/** One control of a note form (`fields()` in forms.ts), rendered by its `type`. A core field
 *  still empty is tinted yellow: it saves, and the row then says ยังไม่ได้จด (V2-RUL-02). */
export function EntryFieldControl({
  field: f,
  values,
  set,
  onFile,
  onFileError,
  autoFocus = false,
}: {
  field: Field;
  values: Values;
  set: (key: string, value: string) => void;
  onFile: (key: string, file: File | null) => void;
  onFileError: (message: string) => void;
  autoFocus?: boolean;
}) {
  const value = values[f.key] ?? "";
  const label = (
    <>
      {f.label}
      {f.unit && (
        <Caption as="span" className="font-normal">
          {" "}
          ({f.unit})
        </Caption>
      )}
    </>
  );
  if (f.type === "file")
    return (
      <FileUploadField
        label={label}
        hint={f.hint}
        accept={f.accept}
        maxBytes={MAX_ATTACHMENT_BYTES}
        oversizeMessage="ไฟล์ใหญ่เกิน 2 MB กรุณาเลือกไฟล์ที่เล็กกว่านี้"
        onError={onFileError}
        onFile={(file) => onFile(f.key, file)}
        fileName={value}
        // The native picker is wider than a 180px column; let it shrink with its cell.
        className="[&_input]:w-full [&_input]:min-w-0"
      />
    );
  const control = {
    autoFocus,
    // Inside a `Dialog`, which focuses it once it opens.
    "data-autofocus": autoFocus || undefined,
    value,
    className: cn(f.core && !value && "border-warning/60 bg-warning-subtle"),
  };
  const onChange = (event: { target: { value: string } }) =>
    set(f.key, event.target.value);
  const pick = (next: string) => set(f.key, next);
  const options = f.options ?? [];
  // A number is typed as text: `mutate` says why it refuses one, the browser would not.
  const input = {
    ...control,
    type: f.type === "date" || f.type === "tel" ? f.type : "text",
    inputMode:
      f.type === "number"
        ? f.integer
          ? ("numeric" as const)
          : ("decimal" as const)
        : undefined,
    autoComplete: "off",
  };
  return (
    <FormField label={label} hint={f.hint} wide={f.type === "textarea"}>
      {f.type === "select" ? (
        <Select
          {...control}
          onChange={pick}
          options={[
            ...(options.some((o) => o.value === "")
              ? []
              : [{ value: "", label: f.core ? `เลือก${f.label}` : "เลือก" }]),
            // A choice the entry already has stands, even when it is no longer offered.
            ...(value && !options.some((o) => o.value === value)
              ? [{ value }]
              : []),
            ...options,
          ]}
        />
      ) : f.type === "time" ? (
        <Select
          {...control}
          onChange={pick}
          options={[
            { value: "", label: "เลือกเวลา" },
            ...timeOptions(value).map((o) => ({ value: o })),
          ]}
        />
      ) : f.type === "textarea" ? (
        <Textarea
          {...control}
          onChange={onChange}
          compact={f.key === "note"}
          rows={f.key === "packs" ? 5 : f.key === "note" ? 1 : 3}
        />
      ) : f.options ? (
        <Combobox
          {...input}
          onChange={pick}
          options={options}
          strict={f.strict}
        />
      ) : (
        <Input {...input} onChange={onChange} />
      )}
    </FormField>
  );
}
