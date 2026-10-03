import { Caption } from "@/components/atoms/Text";
import { AlertListItem } from "@/components/molecules/AlertListItem";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { missingText } from "@/lib/store";

const box = "flex flex-col gap-3 rounded-lg border p-5 max-md:p-4";

/** Everything the account has not jotted yet, as one yellow list: pressing a line opens its
 *  form (or the edit, or the Inventory page). Green and 「จดครบแล้ว」 when there is nothing. */
export function TodoBox({ ws }: { ws: Workspace }) {
  const list = ws.todos;
  if (!list.length)
    return (
      <section
        aria-label={missingText}
        data-tone="ok"
        className={`${box} gap-0 border-success/30 bg-success-subtle text-success`}
      >
        <h2 className="m-0 text-h3">จดครบแล้ว</h2>
        <p className="text-body-sm">ไม่มีรายการที่ยังไม่ได้จด</p>
      </section>
    );
  return (
    <section
      aria-label={missingText}
      data-tone="warning"
      className={`${box} border-warning/40 bg-warning-subtle`}
    >
      <div>
        <h2 className="m-0 text-h3 text-warning">
          {missingText} {list.length} อย่าง
        </h2>
        <Caption>กดที่รายการเพื่อจด</Caption>
      </div>
      <div className="grid gap-1.5">
        {list.map((todo, index) => (
          <AlertListItem
            as="button"
            key={`${todo.text}-${index}`}
            title={todo.text}
            className="min-h-11 items-center border-warning/40 bg-surface hover:border-warning"
            onClick={() => ws.openTodo(todo)}
          />
        ))}
      </div>
    </section>
  );
}
