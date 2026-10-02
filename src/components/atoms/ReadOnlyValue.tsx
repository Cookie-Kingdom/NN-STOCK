import type { ReactNode } from "react";

/**
 * A figure shown while its Settings section is not being edited: real text, not a disabled input, so a
 * screen reader, a text search and a copied page all read the value.
 */
export function ReadOnlyValue({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block min-w-28 py-0.5 text-right font-semibold text-text-secondary">
      {children}
    </span>
  );
}
