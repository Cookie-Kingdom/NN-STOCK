"use client";

import { useState, type ReactNode } from "react";
import { FileInput } from "@/components/atoms/FileInput";
import { Panel } from "@/components/atoms/Panel";
import { Caption } from "@/components/atoms/Text";
import {
  FieldHint,
  OptionalMark,
  fieldClassName,
} from "@/components/molecules/FormField";
import { cn } from "@/lib/utils";

export type FileUploadFieldProps = {
  label: ReactNode;
  /** Keep the label for screen readers only (ConfigView logo cell). */
  hideLabel?: boolean;
  accept?: string;
  /** Files larger than this are rejected: the input is cleared and `onFile` is not called. */
  maxBytes?: number;
  /** Message shown on oversize. Defaults to "ไฟล์ต้องมีขนาดไม่เกิน N MB". */
  oversizeMessage?: string;
  /** Selected file, or `null` when the selection is cleared. Callers do any FileReader work. */
  onFile?: (file: File | null) => void;
  /** Pick several files at once; `onFiles` gets them all (`[]` when cleared) instead of `onFile`. */
  multiple?: boolean;
  onFiles?: (files: File[]) => void;
  /** Also receives the oversize message, for callers that show errors at form level. */
  onError?: (message: string) => void;
  /** Name(s) of the chosen file(s) → "เลือกแล้ว: {name}", one line per name. */
  fileName?: string;
  hint?: ReactNode;
  /** Rendered inside the upload box, under the input (e.g. a logo preview). */
  preview?: ReactNode;
  required?: boolean;
  optional?: boolean;
  /** Replaces "ถ้ามี" in the optional marker, e.g. "ไม่บังคับ". */
  optionalText?: string;
  wide?: boolean;
  disabled?: boolean;
  className?: string;
};

function megabytes(bytes: number) {
  return Number((bytes / (1024 * 1024)).toFixed(1));
}

/**
 * File picker laid out as a form field: a `<label>` around a dashed `Panel` holding
 * the `FileInput`, the chosen `fileName`, an optional `preview` and a hint. `onFile`
 * receives the `File` — or `null` when the selection is cleared — and the caller does
 * any reading. With `maxBytes` set, an oversize pick is rejected here: the input is
 * cleared, the message is shown in place, and `onFile` never fires.
 */
export function FileUploadField({
  label,
  hideLabel = false,
  accept,
  maxBytes,
  oversizeMessage,
  onFile,
  multiple = false,
  onFiles,
  onError,
  fileName,
  hint,
  preview,
  required,
  optional = false,
  optionalText,
  wide = false,
  disabled,
  className,
}: FileUploadFieldProps) {
  const [error, setError] = useState("");
  return (
    <label className={fieldClassName(wide, className)}>
      <span className={cn(hideLabel && "sr-only")}>
        {label}
        {optional && <OptionalMark text={optionalText} />}
      </span>
      <Panel
        as="div"
        dashed
        flush
        className="mt-2 grid gap-2 rounded-md bg-bg p-3"
      >
        <FileInput
          accept={accept}
          multiple={multiple}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            if (
              maxBytes !== undefined &&
              files.some((file) => file.size > maxBytes)
            ) {
              const message =
                oversizeMessage ??
                `ไฟล์ต้องมีขนาดไม่เกิน ${megabytes(maxBytes)} MB`;
              event.currentTarget.value = "";
              setError(message);
              onError?.(message);
              return;
            }
            setError("");
            if (multiple) onFiles?.(files);
            else onFile?.(files[0] ?? null);
          }}
        />
        {fileName && (
          <Caption
            as="span"
            className="font-normal [overflow-wrap:anywhere] whitespace-pre-line"
          >
            เลือกแล้ว: {fileName}
          </Caption>
        )}
        {preview}
        {error && (
          <small role="alert" className="text-caption font-normal text-danger">
            {error}
          </small>
        )}
      </Panel>
      {hint && <FieldHint>{hint}</FieldHint>}
    </label>
  );
}
