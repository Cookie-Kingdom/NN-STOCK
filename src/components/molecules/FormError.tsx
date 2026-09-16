"use client";
import { useEffect, useRef } from "react";
import { Notice } from "@/components/molecules/Notice";

/** Sits at the end of a scrolling dialog body, so a long form used to hide it
 * below the fold and a rejected save looked like nothing happened. */
export function FormError({
  error,
  className,
}: {
  error?: string | null;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) ref.current?.scrollIntoView?.({ block: "nearest" });
  }, [error]);
  return error ? (
    <div ref={ref}>
      <Notice tone="danger" className={className}>
        {error}
      </Notice>
    </div>
  ) : null;
}
