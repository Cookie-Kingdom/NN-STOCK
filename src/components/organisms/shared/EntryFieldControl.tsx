"use client";

import { useId } from "react";
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
  const listId = useId();
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
        oversizeMessage="ไฟล์ใหญ่เกิน 2 MB เว็บไม่รับ"
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
    onChange: (event: { target: { value: string } }) =>
      set(f.key, event.target.value),
  };
  const options = f.options ?? [];
  return (
    <FormField label={label} hint={f.hint} wide={f.type === "textarea"}>
      {f.type === "select" ? (
        <Select {...control}>
          {!options.some((o) => o.value === "") && (
            <option value="">{f.core ? `เลือก${f.label}` : "เลือก"}</option>
          )}
          {/* A choice the entry already has stands, even when it is no longer offered. */}
          {value && !options.some((o) => o.value === value) && (
            <option value={value}>{value}</option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : f.type === "time" ? (
        <Select {...control}>
          <option value="">เลือกเวลา</option>
          {timeOptions(value).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Select>
      ) : f.type === "textarea" ? (
        <Textarea
          {...control}
          compact={f.key === "note"}
          rows={f.key === "packs" ? 5 : f.key === "note" ? 1 : 3}
        />
      ) : (
        <>
          {/* A number is typed as text: `mutate` says why it refuses one, the browser would not. */}
          <Input
            {...control}
            type={f.type === "date" || f.type === "tel" ? f.type : "text"}
            inputMode={
              f.type === "number"
                ? f.integer
                  ? "numeric"
                  : "decimal"
                : undefined
            }
            autoComplete="off"
            list={f.options ? listId : undefined}
          />
          {f.options && (
            <datalist id={listId}>
              {options.map((o) => (
                <option
                  key={o.value}
                  value={o.value}
                  label={o.label !== o.value ? o.label : undefined}
                />
              ))}
            </datalist>
          )}
        </>
      )}
    </FormField>
  );
}
