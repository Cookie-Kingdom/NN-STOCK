import type { Metadata } from "next";
import "./globals.css";
import { notoSansThaiLooped } from "./font";
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "NerdNuea Stock — ระบบสต๊อกและต้นทุนเนื้อรมควัน",
  description:
    "ระบบบันทึกสต๊อกและต้นทุน ตั้งแต่รับเนื้อจาก Foodiva ผ่าน Chef House เข้าสต๊อกกลาง กระจายสู่สาขา จนถึงการขาย",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${notoSansThaiLooped.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved (or OS) theme before first paint; see lib/theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
