import type { ReactNode } from "react";
import { Beef } from "lucide-react";
import { cn } from "@/lib/utils";

/** Logo tile + product name. Shared by the sign-in card (with the tagline) and the workspace
 *  sidebar (`compact`: smaller, and `caption` in place of the tagline). */
export function AppBrand({
  compact = false,
  caption,
}: {
  compact?: boolean;
  caption?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={cn(
          "grid flex-none place-items-center rounded-lg bg-accent text-accent-fg",
          compact ? "size-9" : "size-11",
        )}
      >
        <Beef size={compact ? 20 : 24} />
      </span>
      <div className="min-w-0">
        <strong
          className={cn("block font-semibold", compact ? "text-h3" : "text-h2")}
        >
          NerdNuea <span className="text-text-secondary">Account</span>
        </strong>
        {compact ? (
          caption
        ) : (
          <small className="mt-0.75 block text-caption tracking-[0.05em] text-text-secondary">
            ระบบสต๊อกและต้นทุนเนื้อรมควัน
          </small>
        )}
      </div>
    </div>
  );
}
