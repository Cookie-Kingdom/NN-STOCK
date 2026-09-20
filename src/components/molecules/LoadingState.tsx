import { Panel } from "@/components/atoms/Panel";
import { Spinner } from "@/components/atoms/Spinner";
import { cn } from "@/lib/utils";

/**
 * A grey pulsing block standing in for content that has not arrived yet. It is
 * `aria-hidden` and carries no size of its own, so every use sets the height and width
 * through `className`.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-border", className)}
    />
  );
}

/**
 * What a workspace shows while the database payload is still on its way: the
 * shape of the page (cards + table rows) instead of seed numbers or a blank
 * screen. The shape is fixed height, so nothing jumps when the real rows land.
 */
export function LoadingPanel({
  message = "กำลังโหลดข้อมูลจากระบบ…",
  rows = 5,
}: {
  message?: string;
  rows?: number;
}) {
  return (
    <section
      role="status"
      aria-busy="true"
      /* A load that finishes in under a quarter second never shows this:
         `animate-fade-in` fills `both`, so the delay holds it at opacity 0 and a
         fast connection sees the real page instead of a skeleton flashing past. */
      style={{ animationDelay: "250ms" }}
      className="grid animate-fade-in gap-4.5"
    >
      <p className="flex items-center gap-2 text-body-sm text-text-secondary">
        <Spinner />
        {message}
      </p>
      <div className="grid grid-cols-4 gap-4.5 max-md:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24.5 rounded-lg" />
        ))}
      </div>
      <Panel as="div" flush className="grid gap-2.5 p-5">
        <Skeleton className="mb-1.5 h-5 w-52" />
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-11" />
        ))}
      </Panel>
    </section>
  );
}

/**
 * Whole-page wait: a spinner and one message centred in the viewport, used for the
 * session check and the first paint before the app's JS runs. It announces itself as
 * `role="status"` and fades in after 250ms, so a fast load never flashes it. Use
 * `LoadingPanel` once the shell is on screen and only a workspace is still loading.
 */
export function LoadingScreen({
  message = "กำลังโหลด…",
}: {
  message?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      style={{ animationDelay: "250ms" }}
      className="grid min-h-screen animate-fade-in place-items-center bg-bg px-4 text-body text-text-secondary"
    >
      <p className="flex items-center gap-2.5">
        <Spinner className="size-5" />
        {message}
      </p>
    </div>
  );
}
