import type { ReactNode } from "react";
import { Overline } from "@/components/atoms/Overline";
import { Muted } from "@/components/atoms/Text";

/** Tab title block. */
export function PageHeading({
  overline,
  title,
  description,
}: {
  overline: ReactNode;
  title: ReactNode;
  description: ReactNode;
}) {
  return (
    <div className="mb-6">
      <Overline>{overline}</Overline>
      <h1 className="my-1.5 text-h1">{title}</h1>
      <Muted className="max-md:text-caption">{description}</Muted>
    </div>
  );
}
