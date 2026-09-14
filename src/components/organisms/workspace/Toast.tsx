import { Notice } from "@/components/molecules/Notice";

/** Success message after a save. */
export function Toast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  if (!message) return null;
  return (
    <Notice tone="success" onDismiss={onClose} dismissLabel="ปิดข้อความ">
      {message}
    </Notice>
  );
}
