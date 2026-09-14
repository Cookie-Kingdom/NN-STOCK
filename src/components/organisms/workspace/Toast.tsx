import { X } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { Notice } from "@/components/molecules/Notice";

/** Success message after a save. Uses `action` rather than Notice's `onDismiss`
 * so the close button keeps its accessible name "ปิดข้อความ". */
export function Toast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  if (!message) return null;
  return (
    <Notice
      tone="success"
      action={
        <IconButton
          label="ปิดข้อความ"
          icon={<X size={16} />}
          onClick={onClose}
          className="-my-2"
        />
      }
    >
      {message}
    </Notice>
  );
}
