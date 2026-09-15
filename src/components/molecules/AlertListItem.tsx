import type { ComponentProps, ReactNode } from "react";
import { ArrowRight, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Common = {
  title: ReactNode;
  detail?: ReactNode;
  /** Defaults to CircleAlert. */
  icon?: ReactNode;
};

type DivItem = Common &
  Omit<ComponentProps<"div">, "title" | "children"> & {
    as?: "div";
    /** Rendered under the detail, e.g. a `text` Button. */
    action?: ReactNode;
  };

type ButtonItem = Common &
  Omit<ComponentProps<"button">, "title" | "children"> & {
    as: "button";
  };

function Dot({ icon }: { icon?: ReactNode }) {
  return (
    <span className="grid size-7 flex-none place-items-center rounded-md bg-warning-subtle text-warning">
      {icon ?? <CircleAlert size={15} />}
    </span>
  );
}

/**
 * `as="div"` → `.dashboard-alert-item` (card with optional action).
 * `as="button"` → `.notification-item` (whole row clickable, trailing arrow).
 */
export function AlertListItem(props: DivItem | ButtonItem) {
  if (props.as === "button") {
    const { title, detail, icon, className, type = "button", ...rest } = props;
    delete (rest as { as?: string }).as;
    return (
      <button
        type={type}
        className={cn(
          "grid w-full cursor-pointer grid-cols-[28px_minmax(0,1fr)_16px] items-start gap-2 rounded-lg border border-transparent bg-bg p-2.5 text-left text-inherit transition-colors duration-(--motion-fast) ease-(--ease-standard) hover:border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring",
          className,
        )}
        {...rest}
      >
        <Dot icon={icon} />
        <span className="grid min-w-0 gap-1">
          <strong className="text-body-sm font-semibold">{title}</strong>
          {detail && (
            <small className="text-caption text-text-secondary">{detail}</small>
          )}
        </span>
        <ArrowRight
          size={16}
          className="mt-1 text-text-secondary"
          aria-hidden
        />
      </button>
    );
  }
  const { title, detail, icon, action, className, ...rest } = props;
  delete (rest as { as?: string }).as;
  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-2.5 rounded-lg border border-warning/40 bg-surface p-3",
        className,
      )}
      {...rest}
    >
      <Dot icon={icon} />
      <div className="grid min-w-0 gap-1">
        <strong className="text-body-sm font-semibold text-text-primary">
          {title}
        </strong>
        {detail && (
          <span className="text-caption text-text-secondary">{detail}</span>
        )}
        {action && <div className="mt-0.5 justify-self-start">{action}</div>}
      </div>
    </div>
  );
}
