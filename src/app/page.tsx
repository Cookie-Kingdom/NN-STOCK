"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Muted } from "@/components/atoms/Text";
import { AppBrand } from "@/components/organisms/workspace/AppHeader";
import { signIn, signUp, useSession } from "@/lib/session";

const labelClass =
  "grid gap-1.5 text-caption font-semibold text-text-secondary";
const inputClass = "mt-0 rounded-md px-3 py-2.75 text-body";

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
    <div className="grid min-h-screen place-items-center bg-bg px-4 py-8 text-body text-text-primary">
      <section className="w-full max-w-115 rounded-lg border border-border bg-surface p-7.5 shadow-xs">
        <div className="mb-5.5 border-b border-border pb-5.5">
          <AppBrand />
        </div>
        <h1 className="mb-1 text-h1">
          {mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
        </h1>
        <Muted className="text-body-sm">
          ยืนยันตัวตนและสิทธิ์ผ่าน Supabase
        </Muted>
        <form className="mt-5.5 mb-3.5 grid gap-3.5" onSubmit={submit}>
          {mode === "signup" && (
            <label className={labelClass}>
              ชื่อที่แสดง
              <Input
                className={inputClass}
                required
                name="displayName"
                autoComplete="name"
              />
            </label>
          )}
          <label className={labelClass}>
            อีเมล
            <Input
              className={inputClass}
              required
              type="email"
              name="email"
              autoComplete="email"
            />
          </label>
          <label className={labelClass}>
            รหัสผ่าน
            <Input
              className={inputClass}
              required
              minLength={6}
              type="password"
              name="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </label>
          {(message || sessionError) && (
            <p className="text-caption text-danger">
              {message || sessionError}
            </p>
          )}
          <Button
            variant="primary"
            className="w-full"
            type="submit"
            // ponytail: stays disabled until hydrated and the session check is back; a click
            // before that is a native GET submit that reloads "/" and silently drops the sign-in.
            disabled={busy || !ready}
          >
            {busy
              ? "กำลังดำเนินการ…"
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
        <p className="border-t border-border pt-4 text-caption text-text-secondary">
          บัญชีแรกจะเป็น Owner อัตโนมัติ บัญชีถัดไปต้องให้ Owner
          เปิดใช้งานและกำหนดสิทธิ์
        </p>
      </section>
    </div>
  );
}
