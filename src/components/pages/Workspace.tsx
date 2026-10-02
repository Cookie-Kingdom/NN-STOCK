"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/atoms/Button";
import { Muted } from "@/components/atoms/Text";
import type { Account } from "@/lib/accounts";
import { signOut } from "@/lib/session";

// ponytail: C0 stub, the v2 shell and pages replace it in chunk U1.
export function Workspace({ account }: { account: Account }) {
  const router = useRouter();
  return (
    <main className="grid min-h-screen place-content-center justify-items-center gap-3 p-8">
      <strong className="text-h2">{account.name}</strong>
      <Muted>กำลังสร้าง</Muted>
      <Button
        variant="secondary"
        onClick={async () => {
          await signOut();
          router.replace("/");
        }}
      >
        ออกจากระบบ
      </Button>
    </main>
  );
}
