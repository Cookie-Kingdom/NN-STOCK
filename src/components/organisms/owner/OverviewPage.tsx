import { EmptyState } from "@/components/molecules/EmptyState";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";

// ponytail: placeholder, the page's own chunk (U2–U4) fills it in.
export function OverviewPage({ ws }: { ws: Workspace }) {
  return <EmptyState text={`กำลังสร้างหน้า Overview · ${ws.account.name}`} />;
}
