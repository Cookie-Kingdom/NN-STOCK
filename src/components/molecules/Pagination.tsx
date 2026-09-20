import { Button } from "@/components/atoms/Button";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { cn } from "@/lib/utils";

/**
 * The page controls under a table: the current page and page size on the left,
 * previous/next on the right. `page` is 0-based, and the whole row renders nothing when
 * `pageCount` is 1 or less, so it can be left in place unconditionally.
 */
export function Pagination({
  page,
  pageCount,
  pageSize,
  onPage,
  unit = "แถว",
  className,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  onPage: (page: number) => void;
  unit?: string;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-5 pt-3.5 pb-4.5 text-body-sm text-text-secondary",
        className,
      )}
    >
      <span>
        หน้า {page + 1} / {pageCount} · แสดงครั้งละ {pageSize} {unit}
      </span>
      <ButtonRow className="my-0">
        <Button
          variant="secondary"
          disabled={page <= 0}
          onClick={() => onPage(Math.max(0, page - 1))}
        >
          ก่อนหน้า
        </Button>
        <Button
          variant="secondary"
          disabled={page >= pageCount - 1}
          onClick={() => onPage(Math.min(pageCount - 1, page + 1))}
        >
          ถัดไป
        </Button>
      </ButtonRow>
    </div>
  );
}
