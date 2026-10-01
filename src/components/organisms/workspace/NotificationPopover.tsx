import { Bell } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { CountPill } from "@/components/atoms/CountPill";
import { IconButton } from "@/components/atoms/IconButton";
import { AlertListItem } from "@/components/molecules/AlertListItem";
import { EmptyState } from "@/components/molecules/EmptyState";
import { useId, useRef } from "react";
import type { Tab } from "@/lib/nav";

export type Notification = { title: string; detail: string; tab: Tab };

/** Bell button with a count, opening the list of notices (things not recorded yet, edit
 *  requests and the like); each line jumps to its tab. Shared by the owner and branch routes, so its own copy stays generic.
 *  A native `popover`: the browser owns open/close, Escape, click-outside and the button's
 *  expanded state; CSS anchor positioning hangs the panel under the bell. */
export function NotificationPopover({
  notifications,
  onSelect,
}: {
  notifications: Notification[];
  onSelect: (tab: Tab) => void;
}) {
  const id = useId();
  const panel = useRef<HTMLElement>(null);
  return (
    <div className="group">
      <IconButton
        className="relative border border-border bg-surface text-accent [anchor-name:--notifications] group-has-[:popover-open]:bg-bg"
        label={`การแจ้งเตือน ${notifications.length} รายการ`}
        popoverTarget={id}
        icon={
          <>
            <Bell size={19} />
            {notifications.length > 0 && (
              <CountPill variant="overlay">{notifications.length}</CountPill>
            )}
          </>
        }
      />
      <section
        ref={panel}
        id={id}
        popover="auto"
        className="inset-auto [top:anchor(bottom)] [right:anchor(right)] m-0 mt-2.5 w-[min(390px,calc(100vw-32px))] origin-top-right rounded-lg border border-border bg-surface p-3.5 text-text-primary shadow-lg [position-anchor:--notifications] open:animate-scale-in"
        aria-label="การแจ้งเตือน"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-0.75 pt-0.5 pb-3">
          <div className="grid gap-0.5">
            <strong className="text-body font-semibold">การแจ้งเตือน</strong>
            <span className="text-caption text-text-secondary">
              {notifications.length
                ? `แจ้งเตือน ${notifications.length} รายการ`
                : "ไม่มีแจ้งเตือน"}
            </span>
          </div>
          <Button variant="text" popoverTarget={id} popoverTargetAction="hide">
            ปิด
          </Button>
        </div>
        {notifications.length ? (
          <div className="mt-2.75 grid max-h-97.5 gap-1.75 overflow-auto">
            {notifications.map((notification, index) => (
              <AlertListItem
                as="button"
                key={`${notification.tab}-${notification.title}-${index}`}
                title={notification.title}
                detail={notification.detail}
                onClick={() => {
                  onSelect(notification.tab);
                  panel.current?.hidePopover();
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            compact
            text="ไม่มีแจ้งเตือน"
            className="mx-0.75 mb-0.5"
          />
        )}
      </section>
    </div>
  );
}
