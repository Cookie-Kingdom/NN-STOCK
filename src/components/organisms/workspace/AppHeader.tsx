import type { ReactNode } from "react";
import { Beef } from "lucide-react";
import { ThemeToggle } from "@/components/molecules/ThemeToggle";
import { cn } from "@/lib/utils";

/** Logo tile + product name. Shared by the workspace header and the sign-in card. */
export function AppBrand({ responsive = false }: { responsive?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 flex-none place-items-center rounded-lg bg-accent text-accent-fg">
        <Beef size={24} />
      </span>
      <div>
        <strong
          className={cn(
            "text-h2 font-semibold",
            responsive && "max-md:text-h3",
          )}
        >
          NerdNuea <span className="text-text-secondary">Stock</span>
        </strong>
        <small className="mt-0.75 block text-caption tracking-[0.05em] text-text-secondary">
          ระบบสต๊อกและต้นทุนเนื้อรมควัน
        </small>
      </div>
    </div>
  );
}

/**
 * Top bar of every workspace: brand on the left, `actions` (e.g. notifications) and the
 * theme toggle on the right.
 */
export function AppHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-8 py-4.5 max-md:px-4 max-md:py-3.5">
      <AppBrand responsive />
      <div className="flex flex-wrap items-center gap-2.5">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
