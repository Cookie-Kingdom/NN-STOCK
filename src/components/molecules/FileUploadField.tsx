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
  onFile: (file: File | null) => void;
  /** Also receives the oversize message, for callers that show errors at form level. */
  onError?: (message: string) => void;
  /** Name of the currently chosen file → "เลือกแล้ว: {name}". */
  fileName?: string;
  hint?: ReactNode;
  /** Rendered inside the upload box, under the input (e.g. a logo preview). */
  preview?: ReactNode;
  required?: boolean;
  optional?: boolean;
  wide?: boolean;
  disabled?: boolean;
  className?: string;
};

function megabytes(bytes: number) {
  return Number((bytes / (1024 * 1024)).toFixed(1));
}

/** `.field` + `.file-upload-control` + `.file-uploaded` (and `.config-logo-upload`). */
export function FileUploadField({
  label,
  hideLabel = false,
  accept,
  maxBytes,
  oversizeMessage,
  onFile,
  onError,
  fileName,
  hint,
  preview,
  required,
  optional = false,
  wide = false,
  disabled,
  className,
}: FileUploadFieldProps) {
  const [error, setError] = useState("");
  return (
    <label className={fieldClassName(wide, className)}>
      <span className={cn(hideLabel && "sr-only")}>
        {label}
        {optional && <OptionalMark />}
      </span>
      <Panel
        as="div"
        dashed
        flush
        className="mt-2 grid gap-2 rounded-md bg-bg p-3"
      >
        <FileInput
          accept={accept}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;
            if (file && maxBytes !== undefined && file.size > maxBytes) {
              const message =
                oversizeMessage ??
                `ไฟล์ต้องมีขนาดไม่เกิน ${megabytes(maxBytes)} MB`;
              event.currentTarget.value = "";
              setError(message);
              onError?.(message);
              return;
            }
            setError("");
            onFile(file);
          }}
        />
        {fileName && (
          <Caption as="span" className="font-normal [overflow-wrap:anywhere]">
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
