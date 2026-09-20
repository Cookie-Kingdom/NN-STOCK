import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { AuthShell } from "./AuthShell";

// A template is the page layout with placeholder content; the real sign-in is Pages/SignIn.
const meta = {
  title: "Templates/AuthShell",
  component: AuthShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AuthShell>;

export default meta;
type Story = StoryObj<typeof meta>;

const labelClass =
  "grid gap-1.5 text-caption font-semibold text-text-secondary";
const inputClass = "mt-0 rounded-md px-3 py-2.75 text-body";

function Fields({ signup = false }: { signup?: boolean }) {
  return (
    <form className="mt-5.5 mb-3.5 grid gap-3.5">
      {signup && (
        <label className={labelClass}>
          ชื่อที่แสดง
          <Input className={inputClass} defaultValue="เจ้าของร้าน" />
        </label>
      )}
      <label className={labelClass}>
        อีเมล
        <Input
          className={inputClass}
          type="email"
          defaultValue="owner@nn.test"
        />
      </label>
      <label className={labelClass}>
        รหัสผ่าน
        <Input className={inputClass} type="password" defaultValue="123456" />
      </label>
      <Button variant="primary" className="w-full" type="button">
        {signup ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
      </Button>
    </form>
  );
}

export const SignIn: Story = {
  args: {
    title: "เข้าสู่ระบบ",
    description: "ยืนยันตัวตนและสิทธิ์ผ่าน Supabase",
    footnote:
      "บัญชีแรกจะเป็น Owner อัตโนมัติ บัญชีถัดไปต้องให้ Owner เปิดใช้งานและกำหนดสิทธิ์",
    children: <Fields />,
  },
};

/** The same layout with one more field: the card grows, nothing else moves. */
export const SignUp: Story = {
  args: { ...SignIn.args, title: "สร้างบัญชี", children: <Fields signup /> },
};

/** Without `description` and `footnote` the card is only the brand and the content. */
export const Bare: Story = {
  args: {
    title: "ลิงก์หมดอายุ",
    children: (
      <p className="mt-4 text-body-sm">
        ขอลิงก์ยืนยันอีเมลใหม่ แล้วกลับมาเข้าสู่ระบบอีกครั้ง
      </p>
    ),
  },
};

export const Mobile: Story = {
  ...SignIn,
  globals: { viewport: { value: "mobile1" } },
};
