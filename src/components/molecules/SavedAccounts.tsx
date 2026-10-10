"use client";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import { FormError } from "@/components/molecules/FormError";
import { accountById, type AccountId } from "@/lib/accounts";
import { switchAccount, useSavedAccounts, useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * The accounts that signed in on this device, one row each. Pressing a row opens that account
 * without its password and goes to its workspace; the open account's row is marked and is not
 * a button. A row whose saved session no longer works disappears and the reason shows under
 * the list. Renders nothing, `heading` included, when no account is saved.
 */
export function SavedAccounts({ heading }: { heading?: ReactNode }) {
  const router = useRouter();
  const saved = useSavedAccounts();
  const current = useSession().account?.id;
  const [busy, setBusy] = useState<AccountId | null>(null);
  const [error, setError] = useState("");
  if (!saved.length && !error) return null;

  async function press(id: AccountId) {
    setBusy(id);
    setError("");
    const message = await switchAccount(id);
    setBusy(null);
    if (message) setError(message);
    else router.replace(accountById(id)!.path);
  }
  return (
    <div className="grid gap-2">
      {heading}
      <ul className="m-0 grid list-none gap-0.5 p-0">
        {saved.map(({ id, name }) => {
          const account = accountById(id)!;
          const rowClass =
            "flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left";
          const body = (
            <>
              <span className="grid size-8.5 flex-none place-items-center rounded-md bg-accent-subtle text-accent">
                {busy === id ? (
                  <Spinner />
                ) : (
                  <account.icon size={18} aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-body-sm font-semibold [overflow-wrap:anywhere]">
                  {name}
                </strong>
                <small className="block text-caption [overflow-wrap:anywhere] text-text-secondary">
                  {account.title}
                </small>
              </span>
            </>
          );
          return (
            <li key={id}>
              {id === current ? (
                <div aria-current="true" className={cn(rowClass, "bg-bg")}>
                  {body}
                  <small className="flex-none text-caption text-text-secondary">
                    ใช้งานอยู่
                  </small>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy !== null}
                  aria-busy={busy === id}
                  onClick={() => press(id)}
                  className={cn(
                    rowClass,
                    "cursor-pointer -outline-offset-2 transition-colors duration-(--motion-fast) ease-(--ease-standard) hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40",
                  )}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <FormError error={error} />
    </div>
  );
}
