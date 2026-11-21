import type { Metadata } from "next";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "AI Data Analyst | วิเคราะห์ข้อมูล",
  description: "อัปโหลด ไฟล์ข้อมูล เพื่อสำรวจข้อมูลและคำนวณสถิติจริง",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
