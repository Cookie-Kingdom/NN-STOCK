"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Spinner } from "@/components/atoms/Spinner";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { SavedAccounts } from "@/components/molecules/SavedAccounts";
import { AuthShell } from "@/components/templates/AuthShell";
import { signIn, useSession } from "@/lib/session";

export function SignIn() {
  const router = useRouter();
  const { ready, account, error: sessionError } = useSession();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    /* "/?add" (the sidebar's เพิ่มบัญชี) keeps this page open over the account in use until a
     * sign-in here succeeds. Read here, not in render: the server does not know the query. */
    const adding = new URLSearchParams(window.location.search).has("add");
    if (ready && account && (signedIn || !adding)) router.replace(account.path);
  }, [ready, account, router, signedIn]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // ponytail: uncontrolled inputs. Controlled ones lost whatever was typed or autofilled
    // before hydration: the next re-render wrote the empty state back into the DOM.
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setBusy(true);
    setMessage("");
    const result = await signIn(email, password);
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else setSignedIn(true);
  }
  return (
    <AuthShell
      title="เข้าสู่ระบบ"
      description="ใช้อีเมลและรหัสผ่านที่ Owner ออกให้"
      footnote="ยังไม่มีบัญชี? ติดต่อ Owner เพื่อสร้างบัญชีและกำหนดสิทธิ์"
    >
      <div className="mt-5.5 empty:hidden">
        <SavedAccounts
          heading={
            <h2 className="m-0 text-caption font-medium text-text-secondary">
              บัญชีที่บันทึกไว้
            </h2>
          }
        />
      </div>
      <form className="mt-5.5 mb-3.5 grid gap-3.5" onSubmit={submit}>
        <FormField label="อีเมล">
          <Input required type="email" name="email" autoComplete="email" />
        </FormField>
        <FormField label="รหัสผ่าน">
          <Input
            required
            minLength={6}
            type="password"
            name="password"
            autoComplete="current-password"
          />
        </FormField>
        <FormError error={message || sessionError} />
        <Button
          variant="primary"
          className="w-full"
          type="submit"
          // ponytail: stays disabled until hydrated and the session check is back; a click
          // before that is a native GET submit that reloads "/" and silently drops the sign-in.
          disabled={busy || !ready}
          icon={busy || !ready ? <Spinner /> : undefined}
        >
          {busy ? "กำลังเข้าสู่ระบบ…" : !ready ? "กำลังโหลด…" : "เข้าสู่ระบบ"}
        </Button>
      </form>
      {/* Only "/?add" still shows this page with an account open: its way back. */}
      {account && (
        <Button
          variant="text"
          className="mb-3.5 w-full"
          onClick={() => router.replace(account.path)}
        >
          กลับไปที่ {account.name}
        </Button>
      )}
    </AuthShell>
  );
}
