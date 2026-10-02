import type { ReactNode } from "react";
import { Muted } from "@/components/atoms/Text";

/** The head of a page: its name, the line under it, and at the right the page's one primary
 *  action (จดบันทึก). The action drops under the text when the row is too narrow. */
export function PageHeading({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="m-0 text-h1">{title}</h1>
        <Muted className="text-body-sm">{description}</Muted>
      </div>
      {action}
    </header>
  );
}
