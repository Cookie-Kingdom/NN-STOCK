import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { FormField } from "@/components/molecules/FormField";
import { AuthShell } from "./AuthShell";

// A template is the page layout with placeholder content; the real sign-in is Pages/SignIn.
const meta = {
  title: "Templates/AuthShell",
  component: AuthShell,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AuthShell>;

export default meta;
type Story = StoryObj<typeof meta>;

function Fields() {
  return (
    <form className="mt-5.5 mb-3.5 grid gap-3.5">
      <FormField label="อีเมล">
        <Input type="email" defaultValue="owner@nn.test" />
      </FormField>
      <FormField label="รหัสผ่าน">
        <Input type="password" defaultValue="123456" />
      </FormField>
      <Button variant="primary" className="w-full" type="button">
        เข้าสู่ระบบ
      </Button>
    </form>
  );
}

/** Controls: edit หัวเรื่อง, คำอธิบาย and หมายเหตุท้าย; clear คำอธิบาย and หมายเหตุท้าย for
 *  the bare card (only the brand, the title and the content). */
export const SignIn: Story = {
  argTypes: {
    title: { name: "หัวเรื่อง", control: "text" },
    description: { name: "คำอธิบาย", control: "text" },
    footnote: { name: "หมายเหตุท้าย", control: "text" },
    children: { control: false },
  },
  args: {
    title: "เข้าสู่ระบบ",
    description: "ยืนยันตัวตนและสิทธิ์ผ่าน Supabase",
    footnote: "ยังไม่มีบัญชี? ติดต่อ Owner เพื่อสร้างบัญชีและกำหนดสิทธิ์",
    children: <Fields />,
  },
};

export const Mobile: Story = {
  ...SignIn,
  globals: { viewport: { value: "mobile1" } },
};
