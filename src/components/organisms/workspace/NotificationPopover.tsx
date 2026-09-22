import { Bell } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { CountPill } from "@/components/atoms/CountPill";
import { IconButton } from "@/components/atoms/IconButton";
import { AlertListItem } from "@/components/molecules/AlertListItem";
import { EmptyState } from "@/components/molecules/EmptyState";
import type { Tab } from "@/lib/nav";
import { cn } from "@/lib/utils";

export type Notification = { title: string; detail: string; tab: Tab };

/** Bell button with a count, opening a list of follow-up tasks that each jump to their tab. */
export function NotificationPopover({
  notifications,
  open,
  onToggle,
  onSelect,
}: {
  notifications: Notification[];
  open: boolean;
  onToggle?: () => void;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <div className="relative">
      <IconButton
        className={cn(
          "relative border border-border bg-surface text-accent",
          open && "bg-bg",
        )}
        label={`การแจ้งเตือน ${notifications.length} รายการ`}
        aria-expanded={open}
        onClick={onToggle}
        icon={
          <>
            <Bell size={19} />
            {notifications.length > 0 && (
              <CountPill variant="overlay">{notifications.length}</CountPill>
            )}
          </>
        }
      />
      {open && (
        <section
          className="absolute top-[calc(100%+10px)] right-0 z-20 w-[min(390px,calc(100vw-32px))] origin-top-right animate-scale-in rounded-lg border border-border bg-surface p-3.5 shadow-lg"
          aria-label="รายการที่ต้องทำต่อ"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-0.75 pt-0.5 pb-3">
            <div className="grid gap-0.5">
              <strong className="text-body font-semibold">การแจ้งเตือน</strong>
              <span className="text-caption text-text-secondary">
                {notifications.length
                  ? `ต้องทำต่อ ${notifications.length} รายการ`
                  : "ไม่มีงานค้าง"}
              </span>
            </div>
            <Button variant="text" onClick={onToggle}>
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
                    onToggle?.();
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              text="ยังไม่มีงานที่ต้องทำต่อ"
              className="mx-0.75 mb-0.5"
            />
          )}
        </section>
      )}
    </div>
  );
}
