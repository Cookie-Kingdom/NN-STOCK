import type { ReactNode } from "react";
import { Button } from "@/components/atoms/Button";
import { Overline } from "@/components/atoms/Overline";
import { Muted } from "@/components/atoms/Text";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { today } from "@/lib/format";

/** Tab title block with the working-date picker on the right. */
export function PageHeading({
  overline,
  title,
  description,
  date,
  onDate,
}: {
  overline: ReactNode;
  title: ReactNode;
  description: ReactNode;
  date: string;
  onDate: (date: string) => void;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-5 max-md:items-start max-md:gap-2.5">
      <div>
        <Overline>{overline}</Overline>
        <h1 className="my-1.5 text-h1">{title}</h1>
        <Muted className="max-md:max-w-55 max-md:text-caption">
          {description}
        </Muted>
      </div>
      {/* shrink-0: the title wraps instead, so the date never squeezes under its own
          calendar icon. w-40 holds "dd/mm/yyyy" at the 16px phone size plus the icon. */}
      <div className="flex shrink-0 flex-col gap-1 text-caption text-text-secondary">
        <WorkingDateField
          variant="filter"
          inputClassName="w-40 rounded-md p-2"
          date={date}
          onDate={onDate}
        />
        <Button
          variant="text"
          className="justify-end"
          onClick={() => onDate(today())}
        >
          ใช้วันนี้
        </Button>
      </div>
    </div>
  );
}
