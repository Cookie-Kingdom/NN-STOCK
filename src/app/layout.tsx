import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Follows the OS light/dark setting. Runs in <head> before first paint, so there is no
// flash, and keeps listening so a mid-session switch applies straight away. The `.dark`
// class is the same switch the token layer and Storybook already use.
const systemTheme = `(()=>{const m=matchMedia("(prefers-color-scheme: dark)"),s=()=>document.documentElement.classList.toggle("dark",m.matches);s();m.addEventListener("change",s)})()`;

export const metadata: Metadata = {
  title: "NerdNuea Stock — ระบบสต๊อกและต้นทุนเนื้อรมควัน",
  description:
    "ระบบบันทึกสต๊อกและต้นทุน ตั้งแต่รับเนื้อจาก Foodiva ผ่าน Chef House เข้าสต๊อกกลาง กระจายสู่สาขา จนถึงการขาย",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${notoSansThai.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: systemTheme }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
