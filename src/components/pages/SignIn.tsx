"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Spinner } from "@/components/atoms/Spinner";
import { FormField } from "@/components/molecules/FormField";
import { AuthShell } from "@/components/templates/AuthShell";
import { signIn, useSession } from "@/lib/session";

export function SignIn() {
  const router = useRouter();
  const { ready, account, error: sessionError } = useSession();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (ready && account) router.replace(account.path);
  }, [ready, account, router]);

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
  }
  return (
    <AuthShell
      title="เข้าสู่ระบบ"
      description="ยืนยันตัวตนและสิทธิ์ผ่าน Supabase"
      footnote="ยังไม่มีบัญชี? ติดต่อ Owner เพื่อสร้างบัญชีและกำหนดสิทธิ์"
    >
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
        {(message || sessionError) && (
          <p className="text-caption text-danger">{message || sessionError}</p>
        )}
        <Button
          variant="primary"
          className="w-full"
          type="submit"
          // ponytail: stays disabled until hydrated and the session check is back; a click
          // before that is a native GET submit that reloads "/" and silently drops the sign-in.
          disabled={busy || !ready}
          icon={busy || !ready ? <Spinner /> : undefined}
        >
          {busy
            ? "กำลังดำเนินการ…"
            : !ready
              ? "กำลังเตรียมระบบ…"
              : "เข้าสู่ระบบ"}
        </Button>
      </form>
    </AuthShell>
  );
}
