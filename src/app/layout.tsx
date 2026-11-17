import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

// Geist khong co bo dau tieng Viet (cac chu nhu "ĩ", "ự" roi ve font du phong,
// lech net). Be Vietnam Pro ve rieng cho tieng Viet.
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tin Tức",
  description: "Tổng hợp tin tức tiếng Việt, cập nhật liên tục và tóm tắt tự động",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${beVietnam.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
