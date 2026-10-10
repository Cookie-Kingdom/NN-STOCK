import { Bell } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { CountPill } from "@/components/atoms/CountPill";
import { IconButton } from "@/components/atoms/IconButton";
import { AlertListItem } from "@/components/molecules/AlertListItem";
import { EmptyState } from "@/components/molecules/EmptyState";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { missingText, todoOpens } from "@/lib/store";
import { useId, useRef } from "react";

/** The bell: a count of everything not jotted yet, opening that list; pressing a line opens
 *  its form (or the edit, or the Stock or Inventory page), and a line that opens nothing is
 *  plain. A native `popover`: the browser owns
 *  open/close, Escape, click-outside and the button's expanded state; CSS anchor positioning
 *  hangs the panel on the bell. In the sidebar the bell sits at the bottom left, so the panel
 *  opens upwards from its left edge; in the phone's top bar it opens downwards and keeps to
 *  the screen's gutter. It grows out of the bell and shrinks back faster than it came:
 *  `transition-discrete` keeps it on screen (display, top layer) until the fade is done. */
export function NotificationPopover({ ws }: { ws: Workspace }) {
  const id = useId();
  const panel = useRef<HTMLElement>(null);
  const list = ws.todos;
  return (
    <div className="group">
      <IconButton
        className="relative border border-border bg-surface text-accent [anchor-name:--notifications] group-has-[:popover-open]:bg-bg"
        label={`${missingText} ${list.length} อย่าง`}
        popoverTarget={id}
        icon={
          <>
            <Bell size={19} />
            {list.length > 0 && (
              <CountPill variant="overlay">{list.length}</CountPill>
            )}
          </>
        }
      />
      <section
        ref={panel}
        id={id}
        popover="auto"
        className="inset-auto m-0 w-[min(390px,calc(100vw-32px))] scale-96 rounded-lg border border-border bg-surface p-3.5 text-text-primary opacity-0 shadow-lg transition-[opacity,scale,display,overlay] transition-discrete duration-(--motion-fast) ease-(--ease-exit) [position-anchor:--notifications] open:scale-100 open:opacity-100 open:duration-(--motion-base) open:ease-(--ease-enter) max-md:[top:anchor(bottom)] max-md:right-4 max-md:mt-2.5 max-md:origin-top-right md:[bottom:anchor(top)] md:[left:anchor(left)] md:mb-2.5 md:origin-bottom-left starting:open:scale-96 starting:open:opacity-0"
        aria-label="การแจ้งเตือน"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-0.75 pt-0.5 pb-3">
          <div className="grid gap-0.5">
            <strong className="text-body font-semibold">การแจ้งเตือน</strong>
            <span className="text-caption text-text-secondary">
              {list.length
                ? `${missingText} ${list.length} อย่าง · กดที่รายการเพื่อจด`
                : "จดครบแล้ว"}
            </span>
          </div>
          <Button variant="text" popoverTarget={id} popoverTargetAction="hide">
            ปิด
          </Button>
        </div>
        {/* The list is never taller than the window: a phone on its side still shows the head. */}
        {list.length ? (
          <div className="mt-2.75 grid max-h-[min(24.375rem,100dvh_-_16rem)] gap-1.75 overflow-auto">
            {list.map((todo, index) =>
              todoOpens(todo) ? (
                <AlertListItem
                  as="button"
                  key={`${todo.text}-${index}`}
                  title={todo.text}
                  className="min-h-11 items-center"
                  onClick={() => {
                    ws.openTodo(todo);
                    panel.current?.hidePopover();
                  }}
                />
              ) : (
                <AlertListItem
                  key={`${todo.text}-${index}`}
                  title={todo.text}
                  className="min-h-11 items-center border-transparent bg-bg p-2.5"
                />
              ),
            )}
          </div>
        ) : (
          <EmptyState
            compact
            text="ไม่มีรายการที่ยังไม่ได้จด"
            className="mx-0.75 mb-0.5"
          />
        )}
      </section>
    </div>
  );
}
