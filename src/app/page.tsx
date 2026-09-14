"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Beef } from "lucide-react";
import { signIn, signUp, useSession } from "@/lib/session";

export default function SignInPage() {
  const router = useRouter();
  const { ready, account, error: sessionError } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (ready && account) router.replace(account.path); }, [ready, account, router]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const result = mode === "login" ? await signIn(email, password) : await signUp(email, password, displayName);
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (mode === "signup" && !result.data.session) setMessage("สมัครสำเร็จ กรุณายืนยันอีเมลแล้วกลับมาเข้าสู่ระบบ");
  }
  return <div className="signin-page"><section className="signin-card">
    <div className="signin-brand"><span className="brand-icon"><Beef size={24} /></span><div><strong>NerdNuea <span className="muted">Stock</span></strong><small>ระบบสต๊อกและต้นทุนเนื้อรมควัน</small></div></div>
    <h1>{mode === "login" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}</h1><p className="muted">ยืนยันตัวตนและสิทธิ์ผ่าน Supabase</p>
    <form className="signin-form" onSubmit={submit}>
      {mode === "signup" && <label>ชื่อที่แสดง<input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" /></label>}
      <label>อีเมล<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
      <label>รหัสผ่าน<input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
      {(message || sessionError) && <p className="signin-message">{message || sessionError}</p>}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? "กำลังดำเนินการ…" : mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</button>
    </form>
    <button className="signin-switch" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>{mode === "login" ? "ยังไม่มีบัญชี? สมัครสมาชิก" : "มีบัญชีแล้ว? เข้าสู่ระบบ"}</button>
    <p className="signin-note">บัญชีแรกจะเป็น Owner อัตโนมัติ บัญชีถัดไปต้องให้ Owner เปิดใช้งานและกำหนดสิทธิ์</p>
  </section></div>;
}
