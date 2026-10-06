"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/atoms/Button";

/** How many rows of a long table are drawn: `step` at first, `step` more each time `more`
 *  runs. A new `resetKey` (the search and the filters, as one string) starts over. */
export function useShowMore(resetKey = "", step = 20) {
  const [state, setState] = useState({ key: resetKey, limit: step });
  // Reset while rendering, not in an effect: no frame with the old count.
  if (state.key !== resetKey) setState({ key: resetKey, limit: step });
  const limit = state.key === resetKey ? state.limit : step;
  return {
    limit,
    more: () => setState({ key: resetKey, limit: limit + step }),
  };
}

/** The foot of a table that draws only its first rows: 「ดูเพิ่มเติม」 with how many are left.
 *  Nothing once every row is drawn. */
export function ShowMore({
  shown,
  total,
  onMore,
}: {
  /** Rows drawn now. */
  shown: number;
  total: number;
  onMore: () => void;
}) {
  if (shown >= total) return null;
  return (
    <div className="flex justify-center border-t border-border px-5 py-3">
      <Button size="sm" icon={<ChevronDown />} onClick={onMore}>
        ดูเพิ่มเติม (เหลือ {total - shown})
      </Button>
    </div>
  );
}
