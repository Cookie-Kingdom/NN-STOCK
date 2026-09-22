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
      <div className="flex flex-col gap-1 text-caption text-text-secondary">
        <WorkingDateField
          variant="filter"
          inputClassName="min-w-0 rounded-md p-2 max-md:max-w-34"
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
