"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Notice } from "@/components/molecules/Notice";
import { cn } from "@/lib/utils";

/** How long a success message stays before it closes itself. */
const SHOWN_MS = 6000;

/** Success message after a save, or a danger message when the database refuses one. A
 *  success closes itself after six seconds; a refusal stays until it is closed. `action`
 *  is the one thing to do about it (เลิกทำ) and closes the toast when pressed. */
export function Toast({
  message,
  onClose,
  tone = "success",
  action,
  className,
}: {
  message: string;
  onClose: () => void;
  tone?: "success" | "danger";
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  const close = useEffectEvent(onClose);
  useEffect(() => {
    if (!message || tone !== "success") return;
    const timer = window.setTimeout(close, SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [message, tone]);
  if (!message) return null;
  return (
    // key: a new message remounts, so the fade-up replays instead of swapping text in place.
    <Notice
      key={message}
      tone={tone}
      onDismiss={onClose}
      dismissLabel="ปิดข้อความ"
      className={cn("animate-fade-up", className)}
      action={
        action && (
          <Button
            variant="link"
            className="min-h-11 px-2 font-semibold underline"
            onClick={() => {
              action.onClick();
              onClose();
            }}
          >
            {action.label}
          </Button>
        )
      }
    >
      {message}
    </Notice>
  );
}

/** Shows the `database-error` event persistence.ts dispatches when a load or save fails. */
export function DatabaseErrorToast({ className }: { className?: string }) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const show = (event: Event) =>
      setMessage(String((event as CustomEvent).detail));
    window.addEventListener("database-error", show);
    return () => window.removeEventListener("database-error", show);
  }, []);
  return (
    <Toast
      tone="danger"
      message={message}
      onClose={() => setMessage("")}
      className={className}
    />
  );
}
