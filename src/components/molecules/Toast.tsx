"use client";

import { useEffect, useState } from "react";
import { Notice } from "@/components/molecules/Notice";

/** Success message after a save, or a danger message when the database refuses one. */
export function Toast({
  message,
  onClose,
  tone = "success",
}: {
  message: string;
  onClose: () => void;
  tone?: "success" | "danger";
}) {
  if (!message) return null;
  return (
    // key: a new message remounts, so the fade-up replays instead of swapping text in place.
    <Notice
      key={message}
      tone={tone}
      onDismiss={onClose}
      dismissLabel="ปิดข้อความ"
      className="animate-fade-up"
    >
      {message}
    </Notice>
  );
}

/** Shows the `database-error` event persistence.ts dispatches when a load or save fails. */
export function DatabaseErrorToast() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const show = (event: Event) =>
      setMessage(String((event as CustomEvent).detail));
    window.addEventListener("database-error", show);
    return () => window.removeEventListener("database-error", show);
  }, []);
  return (
    <Toast tone="danger" message={message} onClose={() => setMessage("")} />
  );
}
