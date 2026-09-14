"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, Beef } from "lucide-react";
import { accounts } from "@/lib/accounts";
import { signIn, useSession } from "@/lib/session";

export default function SignInPage() {
  const router = useRouter();
  const { ready, account } = useSession();

  useEffect(() => {
    if (ready && account) router.replace(account.path);
  }, [ready, account, router]);

  return (
    <div className="signin-page">
      <section className="signin-card">
        <div className="signin-brand">
          <span className="brand-icon">
            <Beef size={24} />
          </span>
          <div>
            <strong>
              NerdNuea <span className="muted">Stock</span>
            </strong>
            <small>ระบบสต๊อกและต้นทุนเนื้อรมควัน</small>
          </div>
        </div>
        <h1>เลือกบัญชีเพื่อเข้าใช้งาน</h1>
        <p className="muted">แต่ละบัญชีเห็นเฉพาะงานและข้อมูลตามสิทธิ์ของตัวเอง</p>
        <div className="signin-accounts">
          {accounts.map((item) => (
            <button
              key={item.id}
              type="button"
              className="signin-account"
              onClick={() => {
                signIn(item.id);
                router.push(item.path);
              }}
            >
              <span className="signin-account-icon">
                <item.icon size={20} />
              </span>
              <span className="signin-account-name">
                <strong>{item.name}</strong>
                <small>{item.title}</small>
              </span>
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
        <p className="signin-note">
          ยังไม่ได้ต่อระบบยืนยันตัวตนจริง · ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้
          เมื่อเชื่อม Supabase Auth แล้วหน้านี้จะเปลี่ยนเป็นการเข้าสู่ระบบด้วยรหัสผ่าน
        </p>
      </section>
    </div>
  );
}
