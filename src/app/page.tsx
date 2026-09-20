"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Spinner } from "@/components/atoms/Spinner";
import { FormField } from "@/components/molecules/FormField";
import { AuthShell } from "@/components/templates/AuthShell";
import { signIn, signUp, useSession } from "@/lib/session";

export default function SignInPage() {
  const router = useRouter();
  const { ready, account, error: sessionError } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
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
    const displayName = String(form.get("displayName") ?? "");
    setBusy(true);
    setMessage("");
    const result =
      mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password, displayName);
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (mode === "signup" && !result.data.session)
      setMessage("สมัครสำเร็จ กรุณายืนยันอีเมลแล้วกลับมาเข้าสู่ระบบ");
  }
  return (
    <AuthShell
      title={mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
      description="ยืนยันตัวตนและสิทธิ์ผ่าน Supabase"
      footnote="บัญชีแรกจะเป็น Owner อัตโนมัติ บัญชีถัดไปต้องให้ Owner เปิดใช้งานและกำหนดสิทธิ์"
    >
      <form className="mt-5.5 mb-3.5 grid gap-3.5" onSubmit={submit}>
        {mode === "signup" && (
          <FormField label="ชื่อที่แสดง">
            <Input required name="displayName" autoComplete="name" />
          </FormField>
        )}
        <FormField label="อีเมล">
          <Input required type="email" name="email" autoComplete="email" />
        </FormField>
        <FormField label="รหัสผ่าน">
          <Input
            required
            minLength={6}
            type="password"
            name="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
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
              : mode === "login"
                ? "เข้าสู่ระบบ"
                : "สมัครสมาชิก"}
        </Button>
      </form>
      <Button
        variant="text"
        className="mb-4.5 w-full justify-center text-center"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setMessage("");
        }}
      >
        {mode === "login"
          ? "ยังไม่มีบัญชี? สมัครสมาชิก"
          : "มีบัญชีแล้ว? เข้าสู่ระบบ"}
      </Button>
    </AuthShell>
  );
}
